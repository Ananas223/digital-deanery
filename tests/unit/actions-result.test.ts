import { describe, expect, it } from "vitest";

import { toActionError, type ActionErrorCode } from "@/lib/actions/result";
import { AppError, type ErrorCode } from "@/lib/errors";

const PUBLIC_CODE: Record<ErrorCode, ActionErrorCode> = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  RATE_LIMITED: "RATE_LIMITED",
  AI_UNAVAILABLE: "AI_UNAVAILABLE",
  INTERNAL: "INTERNAL",
};

describe("toActionError", () => {
  it.each(Object.entries(PUBLIC_CODE) as Array<[ErrorCode, ActionErrorCode]>)(
    "переводит %s в публичный код %s",
    (code, expected) => {
      const error = new AppError(code, { requestId: "req-public-1" });
      const result = toActionError(error);

      expect(result).toEqual({
        ok: false,
        error: {
          code: expected,
          message: error.userMessage,
          requestId: "req-public-1",
        },
      });
    },
  );

  it("не раскрывает внутренние детали неизвестной ошибки", () => {
    const result = toActionError(new Error("SQL: SELECT password FROM account"));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.message).toBe("Что-то пошло не так. Попробуйте ещё раз.");
      expect(JSON.stringify(result)).not.toMatch(/select|password|account/i);
      expect(result.error.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });

  it("сохраняет нейтральное сообщение AppError", () => {
    const result = toActionError(
      new AppError("CONFLICT", { userMessage: "Обновите страницу и повторите." }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Обновите страницу и повторите." },
    });
  });
});
