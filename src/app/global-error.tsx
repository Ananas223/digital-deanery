"use client";

import "./globals.css";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Глобальная граница ошибок: заменяет корневой layout,
 * поэтому сама задаёт `html` и `body`.
 */
export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Приложение недоступно
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Не удалось открыть кабинет
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground sm:text-base">
            Сервис столкнулся с непредвиденной ошибкой. Попробуйте обновить страницу — если ошибка
            повторяется, вернитесь позже.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset}>Попробовать снова</Button>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              На главный экран
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Учебный концепт для конкурса. Не официальный сервис вуза.
          </p>
        </main>
      </body>
    </html>
  );
}
