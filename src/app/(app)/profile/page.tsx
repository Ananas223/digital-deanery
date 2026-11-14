import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/layout/logout-button";
import { getRoleLabel } from "@/components/layout/role-label";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getStudentProfile, getStudyFormLabel } from "@/lib/domain/profile";
import { formatCourse } from "@/lib/format";

export const metadata: Metadata = {
  title: "Профиль",
};

/** Профиль студента: личные данные из сессии и академические данные из БД (PRD Ф-01.4–Ф-01.6). */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = user.role === "STUDENT" ? await getStudentProfile(user.id) : null;

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
            <CardTitle className="truncate">{profile?.fullName ?? user.name}</CardTitle>
            <CardDescription>{getRoleLabel(user.role)}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                ФИО
              </dt>
              <dd className="text-sm break-words text-foreground">
                {profile?.fullName ?? user.name}
              </dd>
            </div>
            <div className="min-w-0 space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Контактный e-mail
              </dt>
              <dd className="text-sm break-words text-foreground">
                {profile?.email ?? user.email}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Академические данные</CardTitle>
          <CardDescription>
            Эти данные заполняет деканат: изменить их из профиля нельзя, исправления — через заявку.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile ? (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Факультет
                  </dt>
                  <dd className="text-sm break-words text-foreground">{profile.faculty}</dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Направление подготовки
                  </dt>
                  <dd className="text-sm break-words text-foreground">{profile.program}</dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Группа
                  </dt>
                  <dd className="text-sm text-foreground">{profile.group}</dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Курс
                  </dt>
                  <dd className="text-sm text-foreground">{formatCourse(profile.course)}</dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Форма обучения
                  </dt>
                  <dd className="text-sm text-foreground">
                    {getStudyFormLabel(profile.studyForm)}
                  </dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Номер студенческого
                  </dt>
                  <dd className="text-sm text-foreground">{profile.studentNumber}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                Официальные сведения доступны только для чтения. Чтобы исправить данные, создайте
                заявку — деканат обработает её и обновит профиль.
              </p>
            </>
          ) : (
            <Alert tone="warning" title="Академические данные не найдены">
              {user.role === "DEAN_EMPLOYEE"
                ? "Для сотрудника деканата академические данные студента в этом разделе не отображаются."
                : "Профиль не связан с учебными данными. Обратитесь в деканат — исправление оформляется заявкой."}
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {user.role === "STUDENT" ? (
              <Link href="/requests" className={buttonVariants({ variant: "outline", size: "md" })}>
                Создать заявку
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
