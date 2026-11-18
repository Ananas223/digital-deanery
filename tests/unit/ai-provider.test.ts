import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenRouterModel, isAiEnabled } from "@/lib/ai/provider";

/**
 * Конфигурация провайдера без сети (`docs/specs/p9-ai-assistant.md` § 4.4).
 *
 * Проверяется только разбор окружения и офлайн-создание модели: ни один тест
 * не обращается к OpenRouter, поэтому результат детерминирован.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** Минимальное окружение: `NODE_ENV` обязателен в типе `ProcessEnv`. */
function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}

describe("флаг помощника", () => {
  it("включается только точным значением «true»", () => {
    expect(isAiEnabled(env({ AI_ASSISTANT_ENABLED: "true" }))).toBe(true);

    for (const value of ["TRUE", "True", "1", "yes", "true ", " true", "", undefined]) {
      expect(isAiEnabled(env({ AI_ASSISTANT_ENABLED: value }))).toBe(false);
    }
  });

  it("выключен при пустом окружении", () => {
    expect(isAiEnabled(env({}))).toBe(false);
  });
});

describe("создание модели OpenRouter", () => {
  it("возвращает null без ключа или с пустым ключом", () => {
    expect(createOpenRouterModel(env({}))).toBeNull();
    expect(createOpenRouterModel(env({ AI_PROVIDER_API_KEY: "" }))).toBeNull();
    expect(createOpenRouterModel(env({ AI_PROVIDER_API_KEY: "   " }))).toBeNull();
  });

  it("создаёт модель с ключом и не ходит в сеть", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const model = createOpenRouterModel(
      env({
        AI_PROVIDER_API_KEY: "test-key",
        AI_MODEL: "test/model",
      }),
    );

    expect(model).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
