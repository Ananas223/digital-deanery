import { GraduationCap } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** Нейтральный ответ на неизвестный код: не раскрывает, существует ли справка. */
export default function VerifyCertificateNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-lg bg-primary-muted text-link"
      >
        <GraduationCap aria-hidden="true" className="size-6" />
      </span>

      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Проверка справки
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        Справка не найдена
      </h1>
      <p className="max-w-prose text-sm text-muted-foreground sm:text-base">
        Код не соответствует готовой справке. Проверьте ссылку или QR-код: возможно, справка ещё не
        готова либо код отозван.
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
