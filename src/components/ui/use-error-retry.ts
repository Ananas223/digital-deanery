"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

/**
 * Повторная попытка после ошибки серверного рендера.
 *
 * `reset()` перерисовывает сегмент, но не запрашивает его заново у сервера:
 * без `router.refresh()` пользователь увидит ту же ошибку из кеша RSC.
 * Оба вызова объединены в переход, чтобы интерфейс не мигал промежуточным состоянием.
 */
export function useErrorRetry(reset: () => void): () => void {
  const router = useRouter();

  return () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
}
