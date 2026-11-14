import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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

      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 md:px-6">
          <Logo linked={false} />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10"
      >
        <div className="w-full max-w-md space-y-4">
          {sessionExpired ? (
            <Alert tone="info" title="Сессия истекла">
              {nextPath
                ? "Войдите снова, чтобы вернуться на запрошенную страницу. Введённые данные не сохраняются."
                : "Войдите снова, чтобы продолжить работу. Введённые данные не сохраняются."}
            </Alert>
          ) : null}

          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Вход в кабинет</h1>
            <p className="text-sm text-muted-foreground">
              Введите e-mail и пароль, чтобы открыть свой кабинет.
            </p>
          </div>

          <Card>
            <CardContent className="pt-5">
              <LoginForm nextPath={nextPath} />
            </CardContent>
          </Card>

          <DemoAccess />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
