import { Download } from "lucide-react";

/** Демо-доступ скачивает копию существующей инструкции; учётные данные не входят в JSX. */
export function DemoAccess() {
  return (
    <section
      aria-labelledby="demo-access-heading"
      className="space-y-3 lg:border-t lg:border-border lg:pt-6"
    >
      <h2
        id="demo-access-heading"
        className="text-base leading-6 font-semibold tracking-tight wrap-anywhere text-foreground"
      >
        Демонстрационный доступ
      </h2>
      <p className="text-meta text-pretty text-muted-foreground">
        Для знакомства с кабинетом доступны два студенческих аккаунта. Скачайте данные для входа и
        выберите аккаунт.
      </p>
      <a
        href="/demo/README.txt"
        download="demo-access.txt"
        className="inline-flex min-h-11 items-center gap-3 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <Download aria-hidden="true" className="size-4 shrink-0" />
        Скачать данные для входа
      </a>
      <p className="text-meta text-muted-foreground">
        Учебный концепт для конкурса. Все данные вымышлены.
      </p>
    </section>
  );
}
