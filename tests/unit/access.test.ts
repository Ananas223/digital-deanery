import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { assertOwnership } from "@/lib/domain/access";

describe("assertOwnership", () => {
  it("пропускает совпадение владельца и пользователя", () => {
    expect(() => assertOwnership("user-1", "user-1")).not.toThrow();
  });

  it("бросает нейтральный NOT_FOUND для чужого ресурса", () => {
    expect.assertions(4);

    try {
      assertOwnership("user-1", "user-2");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("NOT_FOUND");
      expect(appError.status).toBe(404);
      // Нейтральный текст не раскрывает существование чужого ресурса.
      expect(appError.userMessage).toBe("Запись не найдена.");
    }
  });

  it("бросает NOT_FOUND, если владелец не определён", () => {
    expect(() => assertOwnership(null as unknown as string, "user-1")).toThrowError(AppError);
    expect(() => assertOwnership(undefined as unknown as string, "user-1")).toThrowError(AppError);
  });
});
