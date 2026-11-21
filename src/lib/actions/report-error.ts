"use server";

import { headers } from "next/headers";

const DIGEST_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Пишет в серверный лог только непрозрачный digest ошибки рендера.
 *
 * Текст ошибки, стек, параметры запроса и данные пользователя не передаются:
 * digest — это хеш, который Next.js уже показывает в error boundary.
 */
export async function reportRenderError(digest: string): Promise<void> {
  if (!DIGEST_PATTERN.test(digest)) {
    return;
  }

  const requestHeaders = await headers();
  const pathname = (requestHeaders.get("x-pathname") ?? "unknown").split("?")[0];

  console.error(`[render-error] digest=${digest} path=${pathname}`);
}
