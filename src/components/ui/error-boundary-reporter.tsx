"use client";

import { useEffect } from "react";

import { reportRenderError } from "@/lib/actions/report-error";

/**
 * Отправляет на сервер только digest ошибки, без текста и персональных данных.
 * Сбой отчёта не должен ломать саму границу ошибки.
 */
export function ErrorBoundaryReporter({ digest }: { digest?: string }) {
  useEffect(() => {
    if (!digest) {
      return;
    }

    void reportRenderError(digest).catch(() => {
      // Отчётность вспомогательная: пользователь всё равно видит экран ошибки.
    });
  }, [digest]);

  return null;
}
