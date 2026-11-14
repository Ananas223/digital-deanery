import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_SUFFIX } from "@/lib/auth/redirect";

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.endsWith(SESSION_COOKIE_SUFFIX));
}

/**
 * Грубая фильтрация на границе приложения (Next.js proxy, бывший middleware).
 *
 * Без cookie сессии сразу отправляем на вход и сохраняем запрошенный путь.
 * Это только редирект: личность и права по-прежнему проверяются на сервере
 * рядом с данными (`AGENTS.md` § 3.2).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", `${pathname}${search}`);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|ttf|otf)$).*)",
  ],
};
