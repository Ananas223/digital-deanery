import { AppError, getErrorMessage } from "@/lib/errors";

/**
 * Публичный результат Server Action: коды совпадают с контрактом заявок
 * (`docs/specs/p4-requests.md` § 4.5), внутренние детали наружу не попадают.
 */
export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ActionErrorCode;
        message: string;
        requestId: string;
      };
    };

function toActionCode(error: AppError): ActionErrorCode {
  return error.code === "VALIDATION" ? "VALIDATION_ERROR" : error.code;
}

/** Преобразует любую ошибку в публичный результат действия. */
export function toActionError(error: unknown): ActionResult<never> {
  const appError = error instanceof AppError ? error : null;

  return {
    ok: false,
    error: {
      code: appError ? toActionCode(appError) : "INTERNAL",
      message: getErrorMessage(error),
      requestId: appError?.requestId ?? globalThis.crypto.randomUUID(),
    },
  };
}
