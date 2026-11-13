import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth/auth";
import { AppError } from "@/lib/errors";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "DEAN_EMPLOYEE";
};

function normalizeRole(value: unknown): CurrentUser["role"] {
  return value === "DEAN_EMPLOYEE" ? "DEAN_EMPLOYEE" : "STUDENT";
}

/**
 * Возвращает текущего пользователя из серверной сессии Better Auth.
 *
 * Обёрнуто в React `cache`, чтобы несколько обращений внутри одного
 * серверного рендера не дублировали запрос к БД.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: normalizeRole(session.user.role),
  };
});

/** Возвращает пользователя или бросает нейтральную ошибку `UNAUTHORIZED`. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("UNAUTHORIZED");
  }

  return user;
}
