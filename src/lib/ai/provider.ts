import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

/**
 * Подключение провайдера ИИ-помощника (`docs/specs/p9-ai-assistant.md` § 4.4,
 * `docs/adr/0005-ai-assistant.md`).
 *
 * Провайдер спрятан за адаптером: маршрут и фронтенд работают с UI-message
 * stream и не знают, какая модель отвечает. Ключ читается только из окружения
 * сервера и никогда не получает префикс `NEXT_PUBLIC_`. Переменные читаются
 * лениво при каждом вызове, а не на импорте: тесты и деплой меняют окружение
 * без перезагрузки модуля.
 */

/** Модель по умолчанию, если `AI_MODEL` не задан. */
export const AI_MODEL_DEFAULT = "deepseek/deepseek-v4.1-flash";

/**
 * Название приложения для атрибуции OpenRouter.
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

/**
 * Создаёт модель провайдера или `null`, если ключ не задан.
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
