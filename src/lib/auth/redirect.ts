/** Имя cookie сессии Better Auth без префикса `__Secure-`. */
export const SESSION_COOKIE_SUFFIX = "better-auth.session_token";

const MAX_NEXT_LENGTH = 2048;

function isUnsafePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return true;
  }

  if (path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path)) {
    return true;
  }

  return path === "/login" || path.startsWith("/login?") || path.startsWith("/login#");
}

/**
 * Проверяет параметр `next` перед возвратом на запрошенную страницу.
 *
 * Разрешены только внутренние пути приложения: протокол-относительные адреса
 * (`//example.com`), обратные слэши и управляющие символы отклоняются, чтобы
 * после входа нельзя было увести пользователя на внешний сайт.
 */
export function sanitizeNextPath(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const path = value.trim();

  if (path.length === 0 || path.length > MAX_NEXT_LENGTH || isUnsafePath(path)) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }

  if (isUnsafePath(decoded)) {
    return null;
  }

  return path;
}
