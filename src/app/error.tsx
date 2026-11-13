"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Граница ошибки сегмента: понятное сообщение и повтор без потери данных формы. */
export default function AppError({ reset }: AppErrorProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Ошибка страницы
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        Не удалось показать страницу
      </h1>
      <p className="max-w-prose text-sm text-muted-foreground sm:text-base">
        Что-то пошло не так при загрузке раздела. Попробуйте открыть его ещё раз — введённые данные
        не потеряны.
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
  );
}
