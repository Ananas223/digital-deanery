import { z } from "zod";

import { AppError } from "@/lib/errors";

/**
 * Проверяет входные данные Zod-схемой на сервере.
 *
 * Одна и та же схема используется формой и сервером; сервер не доверяет
 * клиентской валидации и всегда проверяет вход повторно.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new AppError("VALIDATION", { cause: parsed.error });
  }

  return parsed.data;
}

export type FormattedZodIssue = {
  path: string;
  message: string;
};

/** Приводит ошибки Zod к плоскому виду для отображения в формах. */
export function formatZodIssues(error: z.ZodError): FormattedZodIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join("."),
    message: issue.message,
  }));
}
