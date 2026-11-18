/**
 * Структурные логи ИИ-помощника (`AGENTS.md` § 3.5, § 3.7;
 * `docs/specs/p9-ai-assistant.md` § 4.4).
 *
 * Пишется один JSON-объект с белым списком полей. Промпты, сообщения студентов,
 * ответы модели, заголовки, cookie, тела ответов провайдера, e-mail и прочие
 * персональные данные в лог не попадают — только метрики вызова.
 */

/** Разрешённые поля лога. Список закрыт: расширение — изменение политики. */
export type AiLogFields = {
  requestId: string;
  stepNumber?: number;
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  toolNames?: string[];
  durationMs?: number;
  errorName?: string;
  statusCode?: number;
};

const LOG_KEYS = [
  "requestId",
  "stepNumber",
  "finishReason",
  "inputTokens",
  "outputTokens",
  "toolNames",
  "durationMs",
  "errorName",
  "statusCode",
] as const satisfies readonly (keyof AiLogFields)[];

function serialize(event: string, fields: AiLogFields): string {
  const payload: Record<string, string | number | string[]> = { scope: "ai", event };

  for (const key of LOG_KEYS) {
    const value = fields[key];

    if (value !== undefined) {
      payload[key] = value;
    }
  }

  return JSON.stringify(payload);
}

/** Обычное событие помощника. */
export function logAiEvent(event: string, fields: AiLogFields): void {
  console.info(serialize(event, fields));
}

/** Сбой помощника: реальная ошибка остаётся на сервере. */
export function logAiError(event: string, fields: AiLogFields): void {
  console.error(serialize(event, fields));
}
