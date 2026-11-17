import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";

import { EntranceMark } from "@/components/layout/entrance-mark";
import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
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

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-5 sm:px-6 lg:py-6">
          <Logo linked={false} />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 wrap-anywhere sm:px-6 sm:py-12 lg:py-16"
      >
        <section
          aria-labelledby="login-heading"
          className="grid min-w-0 overflow-hidden rounded-card border border-border bg-card lg:grid-cols-12"
        >
          <div className="min-w-0 space-y-4 bg-background/60 p-6 sm:p-8 lg:col-span-5 lg:border-r lg:border-border lg:p-10 lg:pb-6">
            <h1
              id="login-heading"
              className="text-page-title font-semibold tracking-tight text-balance text-foreground"
            >
              Вход в кабинет
            </h1>
            <p className="max-w-prose text-base leading-relaxed text-pretty text-muted-foreground">
              Ваше расписание и учебные данные. Введите e-mail и пароль своего аккаунта.
            </p>
          </div>

          <div className="min-w-0 p-6 sm:p-8 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:p-10">
            {sessionExpired ? (
              <Alert tone="info" title="Сессия истекла" className="mb-6">
                {nextPath
                  ? "Войдите снова, чтобы вернуться на запрошенную страницу. Введённые данные не сохраняются."
                  : "Войдите снова, чтобы продолжить работу. Введённые данные не сохраняются."}
              </Alert>
            ) : null}

            <LoginForm nextPath={nextPath} />
          </div>

          <aside className="min-w-0 border-t border-border bg-background/60 p-6 sm:p-8 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:border-t-0 lg:border-r lg:p-10 lg:pt-0">
            <DemoAccess />
          </aside>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
