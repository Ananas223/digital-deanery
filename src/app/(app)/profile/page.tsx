import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRoleLabel } from "@/components/layout/role-label";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Профиль",
};

const ACADEMIC_FIELDS = [
  "Группа",
  "Курс",
  "Направление подготовки",
  "Форма обучения",
  "Номер студенческого",
] as const;

/** Профиль: реальные данные сессии; академические поля заполнит деканат (PRD Ф-01). */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Профиль"
        description="Личные и академические данные кабинета. Официальные сведения доступны только для чтения."
      />

      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{user.name}</CardTitle>
            <CardDescription>{getRoleLabel(user.role)}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                ФИО
              </dt>
              <dd className="text-sm break-words text-foreground">{user.name}</dd>
            </div>
            <div className="min-w-0 space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                E-mail
              </dt>
              <dd className="text-sm break-words text-foreground">{user.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Академические данные</CardTitle>
          <CardDescription>
            Эти поля заполняет деканат: изменить их из профиля нельзя, исправления — через заявку.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            {ACADEMIC_FIELDS.map((field) => (
              <div key={field} className="min-w-0 space-y-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {field}
                </dt>
                <dd className="text-sm text-muted-foreground">Нет данных</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Значения появятся после подключения демонстрационной базы деканата. Выдуманные данные в
            профиле не показываются.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
