import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { SESSION_COOKIE_SUFFIX } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Защищённая часть кабинета. Пользователь определяется на сервере по сессии;
 * без сессии — переход на страницу входа (PRD Ф-01.2, AGENTS.md § 3.2).
 *
 * Если cookie сессии была, но сессия недействительна (истекла или отозвана),
 * на странице входа показываем пояснение. Запрошенный путь сохраняем, чтобы
 * после повторного входа вернуть студента туда, куда он шёл.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
    const requestedPath = requestHeaders.get("x-pathname");
    const hadSession = cookieStore
      .getAll()
      .some((cookie) => cookie.name.endsWith(SESSION_COOKIE_SUFFIX));

    const params = new URLSearchParams();
    if (requestedPath) {
      params.set("next", requestedPath);
    }
    if (hadSession) {
      params.set("expired", "1");
    }

    const query = params.toString();
    redirect(query ? `/login?${query}` : "/login");
  }

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }}>{children}</AppShell>
  );
}
