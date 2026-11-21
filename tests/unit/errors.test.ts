import { describe, expect, it } from "vitest";

import { AppError, getErrorMessage, toPublicError, type ErrorCode } from "@/lib/errors";

const EXPECTED_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

describe("AppError", () => {
  it.each(Object.entries(EXPECTED_STATUS) as Array<[ErrorCode, number]>)(
    "код %s имеет статус %i",
    (code, status) => {
      const error = new AppError(code);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("AppError");
      expect(error.code).toBe(code);
      expect(error.status).toBe(status);
    },
  );

  it("по умолчанию использует нейтральное сообщение без внутренних деталей", () => {
    const error = new AppError("INTERNAL", {
      cause: new Error("postgresql://user:secret@localhost/db"),
    });

    expect(error.userMessage).toBe("Что-то пошло не так. Попробуйте ещё раз.");
    expect(error.message).toBe(error.userMessage);
    expect(error.userMessage).not.toMatch(/postgres|secret|localhost/i);
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("принимает собственное нейтральное сообщение и requestId", () => {
    const error = new AppError("CONFLICT", {
      userMessage: "Заявка уже обработана.",
      requestId: "req-42",
    });

    expect(error.userMessage).toBe("Заявка уже обработана.");
    expect(error.requestId).toBe("req-42");
  });
});

describe("toPublicError", () => {
  it("не раскрывает причину и стек ошибки", () => {
    const secretCause = new Error("SQL: SELECT password FROM account");
    const error = new AppError("INTERNAL", {
      cause: secretCause,
      requestId: "req-7",
    });

    const payload = toPublicError(error);
    const serialized = JSON.stringify(payload);

    expect(payload.error).toEqual({
      code: "INTERNAL",
      message: "Что-то пошло не так. Попробуйте ещё раз.",
      requestId: "req-7",
    });
    expect(serialized).not.toContain("SELECT password");
    expect(serialized).not.toContain("account");
    expect(serialized).not.toContain("stack");
  });

  it("всегда содержит requestId: генерирует его для неизвестной ошибки", () => {
    const payload = toPublicError(new Error("boom"));

    expect(payload.error.code).toBe("INTERNAL");
    expect(payload.error.message).toBe("Что-то пошло не так. Попробуйте ещё раз.");
    expect(payload.error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("предпочитает переданный requestId сохранённому в ошибке", () => {
    const payload = toPublicError(new AppError("NOT_FOUND", { requestId: "old" }), "new");

    expect(payload.error.requestId).toBe("new");
  });

  it("возвращает нейтральное сообщение для не-AppError", () => {
    expect(getErrorMessage(new Error("Внутренний сбой"))).toBe(
      "Что-то пошло не так. Попробуйте ещё раз.",
    );
    expect(getErrorMessage(new AppError("FORBIDDEN"))).toBe(
      "Недостаточно прав для этого действия.",
    );
  });
});
