import "server-only";

import {
  APICallError,
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
} from "ai";

import { AppError, toPublicError, type ErrorCode } from "@/lib/errors";
import { AI_MAX_BODY_BYTES, chatRequestSchema } from "@/lib/validation/ai";

import { logAiError, logAiEvent, type AiLogFields } from "./observability";
import type { AiRateLimiter } from "./rate-limit";
import { AI_SYSTEM_PROMPT } from "./system-prompt";
import { createAiTools } from "./tools";

/**
 * Обработчик `POST /api/ai/chat` (`docs/specs/p9-ai-assistant.md` § 4.4).
 *
 * Модуль не знает про `next/headers` и Next.js: все зависимости приходят
 * аргументом, поэтому маршрут — тонкий адаптер, а обработчик тестируется без
 * серверного запроса. Порядок проверок фиксирован: сессия → роль → флаг →
 * тело и размер → модель → лимит → стрим. Конфигурация провайдера проверяется
 * до списания квоты, поэтому её сбой отвечает `503`, а не `429`.
 */

/** Сколько шагов инструментов разрешено в одном ответе. */
const MAX_STEPS = 4;

/** Бюджет ответа модели. */
const MAX_OUTPUT_TOKENS = 800;

/** Общий таймаут запроса и отдельного шага. */
const TOTAL_TIMEOUT_MS = 45_000;
const STEP_TIMEOUT_MS = 20_000;

/** Нейтральный текст ошибки в стриме: детали остаются на сервере. */
const STREAM_ERROR_TEXT = "Помощник временно недоступен. Остальные разделы работают.";

const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

export type AiChatUser = { id: string; role: "STUDENT" | "DEAN_EMPLOYEE" };

export type AiChatDeps = {
  getUser: () => Promise<AiChatUser | null>;
  isEnabled: () => boolean;
  createModel: () => LanguageModel | null;
  limiter: AiRateLimiter;
  now?: () => Date;
  /** Логгер информационных событий; ошибки всегда идут через `logAiError`. */
  log?: (event: string, fields: AiLogFields) => void;
};

/** Имя ошибки для лога: без сообщения, стека и деталей провайдера. */
function describeError(error: unknown): { errorName: string; statusCode?: number } {
  const errorName = error instanceof Error ? error.name : "UnknownError";

  if (APICallError.isInstance(error)) {
    return { errorName, statusCode: error.statusCode };
  }

  return { errorName };
}

/**
 * Создаёт обработчик с внедрёнными зависимостями.
 *
 * Возвращает функцию `(request) => Response`: JSON-ошибки с реальными
 * статусами до стрима и UI-message stream после него.
 */
export function createAiChatHandler(deps: AiChatDeps): (request: Request) => Promise<Response> {
  const now = deps.now ?? (() => new Date());
  const logInfo = deps.log ?? logAiEvent;

  /**
   * Ошибки всегда попадают в серверный канал `logAiError`; внедрённый логгер
   * дополнительно видит событие, чтобы тесты проверяли логи, не подменяя канал.
   */
  function logError(event: string, fields: AiLogFields): void {
    logAiError(event, fields);

    if (deps.log) {
      deps.log(event, fields);
    }
  }

  return async function handleChatRequest(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID();

    /** Единый JSON-ответ ошибки: реальный статус, без кеша и без деталей. */
    function fail(code: ErrorCode): Response {
      const error = new AppError(code);

      return Response.json(toPublicError(error, requestId), {
        status: error.status,
        headers: { ...NO_STORE_HEADERS, "x-request-id": requestId },
      });
    }

    let user: AiChatUser | null;

    try {
      user = await deps.getUser();
    } catch (error) {
      if (error instanceof AppError && error.code === "UNAUTHORIZED") {
        return fail("UNAUTHORIZED");
      }

      logError("chat.session_failed", { requestId, ...describeError(error) });

      return fail("INTERNAL");
    }

    if (!user) {
      return fail("UNAUTHORIZED");
    }

    if (user.role === "DEAN_EMPLOYEE") {
      return fail("FORBIDDEN");
    }

    // Флаг проверяется до чтения тела и до обращения к провайдеру.
    if (!deps.isEnabled()) {
      return fail("AI_UNAVAILABLE");
    }

    // Тело ограничено по байтам до чтения: кириллица в UTF-8 занимает два байта
    // на символ, поэтому 20 000 символов истории легко превышают 40 000 байт.
    const contentLength = request.headers.get("content-length");
    const declaredBytes = contentLength === null ? Number.NaN : Number(contentLength);

    if (Number.isFinite(declaredBytes) && declaredBytes > AI_MAX_BODY_BYTES) {
      return fail("VALIDATION");
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail("VALIDATION");
    }

    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return fail("VALIDATION");
    }

    const currentTime = now();

    // Сломанная конфигурация провайдера — это 503, а не 429: тело уже проверено,
    // но квота пользователя не тратится, пока модель не создана.
    let model: LanguageModel | null;

    try {
      model = deps.createModel();
    } catch (error) {
      logError("chat.model_failed", { requestId, ...describeError(error) });

      return fail("AI_UNAVAILABLE");
    }

    if (!model) {
      return fail("AI_UNAVAILABLE");
    }

    if (!deps.limiter.tryConsume(user.id, currentTime)) {
      return fail("RATE_LIMITED");
    }

    const startedAt = Date.now();
    const headers = { ...NO_STORE_HEADERS, "x-request-id": requestId };

    try {
      const result = streamText({
        model,
        system: AI_SYSTEM_PROMPT,
        messages: await convertToModelMessages(parsed.data.messages),
        tools: createAiTools(user.id, currentTime, { requestId }),
        stopWhen: stepCountIs(MAX_STEPS),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRetries: 1,
        timeout: { totalMs: TOTAL_TIMEOUT_MS, stepMs: STEP_TIMEOUT_MS },
        abortSignal: request.signal,
        onStepFinish: (step) => {
          logInfo("chat.step", {
            requestId,
            stepNumber: step.stepNumber,
            finishReason: step.finishReason,
            inputTokens: step.usage.inputTokens,
            outputTokens: step.usage.outputTokens,
            toolNames: step.toolCalls.map((call) => call.toolName),
          });
        },
        onFinish: (event) => {
          logInfo("chat.finish", {
            requestId,
            finishReason: event.finishReason,
            inputTokens: event.totalUsage.inputTokens,
            outputTokens: event.totalUsage.outputTokens,
            toolNames: event.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
            durationMs: Date.now() - startedAt,
          });
        },
      });

      return result.toUIMessageStreamResponse({
        headers,
        onError: (error) => {
          logError("chat.stream_failed", { requestId, ...describeError(error) });

          return STREAM_ERROR_TEXT;
        },
      });
    } catch (error) {
      // Синхронный сбой до стрима: статус ещё можно выбрать честно.
      logError("chat.failed", { requestId, ...describeError(error) });

      return fail("AI_UNAVAILABLE");
    }
  };
}
