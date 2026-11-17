import { GraduationCap } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** 404 вне оболочки кабинета: нейтральное сообщение без раскрытия чужих ресурсов. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-lg bg-primary-muted text-link"
      >
        <GraduationCap aria-hidden="true" className="size-6" />
      </span>

      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Страница не найдена
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        Такой страницы в кабинете нет
      </h1>
      <p className="max-w-prose text-sm text-muted-foreground sm:text-base">
        Возможно, ссылка устарела или адрес введён с ошибкой. Вернитесь на главный экран — оттуда
        доступны все разделы.
      </p>

      <Link href="/" className={buttonVariants({ className: "mt-2" })}>
        На главный экран
      </Link>

      <p className="mt-4 text-xs text-muted-foreground">
        Учебный концепт для конкурса. Не официальный сервис вуза.
      </p>
    </main>
  );
}
