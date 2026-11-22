import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import { createCodexCodeModel, CODEX_CODE_BASE_URL_DEFAULT } from "./codex-code";

/**
 * Подключение провайдера ИИ-помощника (`docs/specs/p9-ai-assistant.md` § 4.4,
 * `docs/adr/0005-ai-assistant.md`).
 *
 * Провайдер спрятан за адаптером: маршрут и фронтенд работают с UI-message
 * stream и не знают, какая модель отвечает. Ключ читается только из окружения
 * сервера и никогда не получает префикс `NEXT_PUBLIC_`. Переменные читаются
 * лениво при каждом вызове, а не на импорте: тесты и деплой меняют окружение
 * без перезагрузки модуля.
 *
 * Поддерживаются два провайдера, выбираемых переменной `AI_PROVIDER`:
 * `openrouter` (по умолчанию) и `codex-code` (OpenAI-совместимый API).
 * Контракт маршрута и формат ответа не зависят от провайдера.
 */

/** Модель по умолчанию, если `AI_MODEL` не задан. */
export const AI_MODEL_DEFAULT = "deepseek-flash";

/** Провайдер по умолчанию. */
export const AI_PROVIDER_DEFAULT = "openrouter";

/** Допустимые значения переменной `AI_PROVIDER`. */
export type AiProvider = "openrouter" | "codex-code";

/** Название приложения для атрибуции OpenRouter.
 *
 * Провайдер отправляет его заголовком `X-OpenRouter-Title`, а значения
 * заголовков допускают только ISO-8859-1: кириллица роняет `fetch` с
 * `TypeError` до отправки запроса. Поэтому здесь только ASCII.
 */
export const AI_APP_NAME = "Digital Deanery";

/** Флаг включённого помощника: только точное значение `"true"` включает его. */
export function isAiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["AI_ASSISTANT_ENABLED"] === "true";
}

/** Читает ключ провайдера Codex Code из окружения. */
function codexCodeApiKey(env: NodeJS.ProcessEnv): string | undefined {
  return env["AI_CODEX_CODE_API_KEY"]?.trim();
}

/** Создаёт модель OpenRouter или `null`, если ключ не задан.
 *
 * `null` — не ошибка: маршрут отвечает `503 AI_UNAVAILABLE`, а ядро кабинета
 * продолжает работать.
 */
export function createOpenRouterModel(env: NodeJS.ProcessEnv = process.env): LanguageModel | null {
  const apiKey = env["AI_PROVIDER_API_KEY"]?.trim();

  if (!apiKey) {
    return null;
  }

  const modelId = env["AI_MODEL"]?.trim() || AI_MODEL_DEFAULT;

  const provider = createOpenRouter({
    apiKey,
    appUrl: env["NEXT_PUBLIC_APP_URL"],
    appName: AI_APP_NAME,
  });

  return provider.chat(modelId);
}

/** Создаёт модель Codex Code или `null`, если ключ не задан.
 *
 * Кодекс-Код — OpenAI-совместимый API (`https://codexcode.tech/v1`).
 * Ключ берётся из `AI_CODEX_CODE_API_KEY` (содержимое `./token`),
 * базовый URL — из `AI_CODEX_CODE_BASE_URL`.
 */
export function createCodexCodeProviderModel(
  env: NodeJS.ProcessEnv = process.env,
): LanguageModel | null {
  const apiKey = codexCodeApiKey(env);

  if (!apiKey) {
    return null;
  }

  const modelId = env["AI_MODEL"]?.trim() || AI_MODEL_DEFAULT;
  const baseUrl = env["AI_CODEX_CODE_BASE_URL"]?.trim() || CODEX_CODE_BASE_URL_DEFAULT;

  return createCodexCodeModel({ apiKey, baseUrl, modelId });
}

/**
 * Фабрика модели: выбирает провайдер по `AI_PROVIDER` (по умолчанию `openrouter`).
 *
 * Возвращает `null`, если ключ выбранного провайдера не задан — маршрут ответит
 * `503 AI_UNAVAILABLE` без утечки конфигурации.
 */
export function createAiModel(env: NodeJS.ProcessEnv = process.env): LanguageModel | null {
  const rawProvider = env["AI_PROVIDER"]?.trim();

  if (rawProvider === undefined || rawProvider === "") {
    return createOpenRouterModel(env);
  }

  if (!isValidAiProvider(rawProvider)) {
    return null;
  }

  if (rawProvider === "codex-code") {
    return createCodexCodeProviderModel(env);
  }

  return createOpenRouterModel(env);
}

/** Проверяет, что значение `AI_PROVIDER` допустимо. */
export function isValidAiProvider(value: string | undefined): value is AiProvider {
  return value === "openrouter" || value === "codex-code";
}
