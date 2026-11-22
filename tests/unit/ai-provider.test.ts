import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_APP_NAME,
  createAiModel,
  createCodexCodeProviderModel,
  createOpenRouterModel,
  isAiEnabled,
  isValidAiProvider,
} from "@/lib/ai/provider";

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

  it("название приложения помещается в HTTP-заголовок без кириллицы", () => {
    // Провайдер отправляет AI_APP_NAME заголовком X-OpenRouter-Title:
    // кириллица роняет fetch ещё до отправки запроса (ByteString).
    expect(() => new Headers({ "X-OpenRouter-Title": AI_APP_NAME })).not.toThrow();
    expect(AI_APP_NAME).toMatch(/^[\x20-\x7E]+$/);
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

describe("создание модели Codex Code", () => {
  it("возвращает null без ключа или с пустым ключом", () => {
    expect(createCodexCodeProviderModel(env({}))).toBeNull();
    expect(createCodexCodeProviderModel(env({ AI_CODEX_CODE_API_KEY: "" }))).toBeNull();
    expect(createCodexCodeProviderModel(env({ AI_CODEX_CODE_API_KEY: "   " }))).toBeNull();
  });

  it("создаёт модель с ключом и не ходит в сеть", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const model = createCodexCodeProviderModel(
      env({
        AI_CODEX_CODE_API_KEY: "test-key",
        AI_MODEL: "test/model",
      }),
    );

    expect(model).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("использует базовый URL по умолчанию, если не задан", () => {
    const model = createCodexCodeProviderModel(env({ AI_CODEX_CODE_API_KEY: "test-key" }));

    expect(model).not.toBeNull();
  });
});

describe("фабрика createAiModel", () => {
  it("по умолчанию выбирает OpenRouter", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const model = createAiModel(
      env({
        AI_PROVIDER_API_KEY: "test-key",
        AI_MODEL: "test/model",
      }),
    );

    expect(model).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("выбирает Codex Code при AI_PROVIDER=codex-code с ключом", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const model = createAiModel(
      env({
        AI_PROVIDER: "codex-code",
        AI_CODEX_CODE_API_KEY: "test-key",
        AI_MODEL: "test/model",
      }),
    );

    expect(model).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("возвращает null для Codex Code без ключа, даже если задан провайдер", () => {
    const model = createAiModel(
      env({
        AI_PROVIDER: "codex-code",
      }),
    );

    expect(model).toBeNull();
  });

  it("возвращает null для OpenRouter без ключа", () => {
    const model = createAiModel(
      env({
        AI_PROVIDER: "openrouter",
      }),
    );

    expect(model).toBeNull();
  });

  it("неизвестный провайдер возвращает null", () => {
    const model = createAiModel(
      env({
        AI_PROVIDER: "unknown-provider",
        AI_PROVIDER_API_KEY: "test-key",
        AI_MODEL: "test/model",
      }),
    );

    expect(model).toBeNull();
  });
});

describe("проверка допустимого провайдера", () => {
  it.each([
    ["openrouter", true],
    ["codex-code", true],
    ["", false],
    ["unknown", false],
    [undefined, false],
  ])("isValidAiProvider(%s) = %s", (value, expected) => {
    expect(isValidAiProvider(value)).toBe(expected);
  });
});
