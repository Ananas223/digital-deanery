export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

const ERROR_STATUS: Record<ErrorCode, number> = {
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

const PUBLIC_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Требуется вход в кабинет.",
  FORBIDDEN: "Недостаточно прав для этого действия.",
  NOT_FOUND: "Запись не найдена.",
  VALIDATION: "Проверьте заполнение полей.",
  CONFLICT: "Действие уже выполнено или данные конфликтуют.",
  INVALID_TRANSITION: "Это действие сейчас недоступно.",
  RATE_LIMITED: "Попробуйте позже.",
  AI_UNAVAILABLE: "Помощник временно недоступен. Остальные разделы работают.",
  INTERNAL: "Что-то пошло не так. Попробуйте ещё раз.",
};

export type AppErrorOptions = {
  /** Нейтральное сообщение для пользователя. По умолчанию берётся из кода. */
  userMessage?: string;
  /** Внутренняя причина для серверных логов; наружу не отдаётся. */
  cause?: unknown;
  /** Идентификатор запроса для сопоставления с серверными логами. */
  requestId?: string;
};

/**
 * Единая ошибка приложения для Server Actions и Route Handlers.
 *
 * `userMessage` всегда нейтрально и не содержит стек, SQL или внутренние
 * детали. `cause` и `requestId` используются только на сервере.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly userMessage: string;
  readonly requestId?: string;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const userMessage = options.userMessage ?? PUBLIC_MESSAGES[code];

    super(userMessage, options.cause === undefined ? undefined : { cause: options.cause });

    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.userMessage = userMessage;
    this.requestId = options.requestId;
  }
}

export type PublicError = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
};

/**
 * Преобразует любую ошибку в единый публичный формат API.
 * Внутренние детали и стек наружу не попадают.
 */
export function toPublicError(error: unknown, requestId?: string): PublicError {
  const appError = error instanceof AppError ? error : null;

  return {
    error: {
      code: appError?.code ?? "INTERNAL",
      message: appError?.userMessage ?? PUBLIC_MESSAGES.INTERNAL,
      requestId: requestId ?? appError?.requestId ?? globalThis.crypto.randomUUID(),
    },
  };
}

/** Безопасное сообщение для UI: не раскрывает внутренние детали ошибки. */
export function getErrorMessage(error: unknown): string {
  return error instanceof AppError ? error.userMessage : PUBLIC_MESSAGES.INTERNAL;
}
