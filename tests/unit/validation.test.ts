import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { formatZodIssues, parseInput } from "@/lib/validation/parse";

const schema = z.object({
  email: z.email(),
  course: z.number().int().positive(),
});

describe("parseInput", () => {
  it("возвращает типизированные данные для валидного входа", () => {
    const parsed = parseInput(schema, { email: "student@example.com", course: 2 });

    expect(parsed).toEqual({ email: "student@example.com", course: 2 });
  });

  it("бросает AppError VALIDATION для невалидного входа", () => {
    expect.assertions(5);

    try {
      parseInput(schema, { email: "not-an-email", course: -1 });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("VALIDATION");
      expect(appError.status).toBe(422);
      expect(appError.userMessage).toBe("Проверьте заполнение полей.");
      expect(appError.cause).toBeInstanceOf(z.ZodError);
    }
  });

  it("отклоняет отсутствующие обязательные поля", () => {
    expect(() => parseInput(schema, {})).toThrowError(AppError);
  });

  it("не доверяет лишним полям и отбрасывает их", () => {
    const parsed = parseInput(schema, {
      email: "student@example.com",
      course: 1,
      role: "DEAN_EMPLOYEE",
    });

    expect(parsed).toEqual({ email: "student@example.com", course: 1 });
    expect(parsed).not.toHaveProperty("role");
  });
});

describe("formatZodIssues", () => {
  it("приводит ошибки Zod к плоскому виду с путём поля", () => {
    const result = schema.safeParse({ email: "nope", course: 0 });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const issues = formatZodIssues(result.error);

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.path).sort()).toEqual(["course", "email"]);
    for (const issue of issues) {
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });
});
