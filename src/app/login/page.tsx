import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Вход",
};

/** Страница входа вне оболочки кабинета. Уже вошедшего пользователя отправляем на главную. */
export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
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
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Вход в кабинет</h1>
            <p className="text-sm text-muted-foreground">
              Введите e-mail и пароль, чтобы открыть свой кабинет.
            </p>
          </div>

          <Card>
            <CardContent className="pt-5">
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
