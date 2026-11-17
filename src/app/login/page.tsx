import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";

import { EntranceMark } from "@/components/layout/entrance-mark";
import { RouteMark } from "@/components/layout/route-mark";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

import { DemoAccess } from "./demo-access";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Вход",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Страница входа вне оболочки кабинета. Уже вошедшего пользователя отправляем дальше. */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params["next"]);
  const sessionExpired = firstParam(params["expired"]) === "1";
  const user = await getCurrentUser();

  if (user) {
    redirect((nextPath ?? "/") as Route);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <EntranceMark />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 wrap-anywhere sm:px-6 sm:py-10 lg:py-16"
      >
        <section className="grid min-w-0 rounded-card border border-border bg-card lg:grid-cols-12">
          <header className="min-w-0 rounded-t-card bg-background p-5 sm:p-8 lg:col-span-5 lg:rounded-tl-card lg:rounded-tr-none lg:border-r lg:border-border lg:p-10 lg:pb-8">
            <div className="mb-4 flex items-center justify-between gap-4 lg:mb-6">
              <RouteMark className="size-10 text-link lg:size-12" />
              <ThemeToggle />
            </div>
            <h1 className="text-brand-title text-balance text-foreground">Деканат будущего</h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-pretty text-muted-foreground">
              Ваше расписание и учебные данные.
            </p>
          </header>

          <div className="min-w-0 border-t border-border p-5 sm:p-8 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:border-t-0 lg:p-10">
            <div className="mb-6 space-y-2">
              <h2
                id="login-heading"
                className="text-xl leading-7 font-semibold tracking-tight text-balance text-foreground"
              >
                Вход в кабинет
              </h2>
              <p className="text-meta text-pretty text-muted-foreground">
                Введите e-mail и пароль своего аккаунта.
              </p>
            </div>

            {sessionExpired ? (
              <Alert tone="info" title="Сессия истекла" className="mb-6">
                {nextPath
                  ? "Войдите снова, чтобы вернуться на запрошенную страницу. Введённые данные не сохраняются."
                  : "Войдите снова, чтобы продолжить работу. Введённые данные не сохраняются."}
              </Alert>
            ) : null}

            <LoginForm nextPath={nextPath} />
          </div>

          <aside className="min-w-0 rounded-b-card border-t border-border bg-background p-5 sm:p-8 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:rounded-r-none lg:border-t-0 lg:border-r lg:p-10 lg:pt-0">
            <DemoAccess />
          </aside>
        </section>
      </main>

      <div className="px-4 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
