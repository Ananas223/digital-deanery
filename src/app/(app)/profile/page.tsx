import { ArrowRight, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/layout/logout-button";
import { getRoleLabel } from "@/components/layout/role-label";
import { AcademicDetails } from "@/components/profile/academic-details";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth/session";
import { getStudentProfile } from "@/lib/domain/profile";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Профиль",
};

/** Профиль текущего пользователя; академические сведения доступны только для чтения. */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = user.role === "STUDENT" ? await getStudentProfile(user.id) : null;
  const fullName = profile?.fullName ?? user.name;

  return (
    <div className="min-w-0 space-y-6 wrap-anywhere sm:space-y-8">
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-page-title font-semibold tracking-tight text-balance">Профиль</h1>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground sm:text-base">
            Личные и учебные сведения вашего кабинета.
          </p>
        </div>
        <LogoutButton />
      </header>

      <div className="grid min-w-0 rounded-card border border-border bg-card xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <section
            aria-labelledby="profile-name"
            className="flex min-w-0 flex-wrap items-start gap-4 border-b border-border p-5 sm:items-center sm:gap-6 sm:p-8"
          >
            <Avatar
              name={fullName}
              size="lg"
              className="size-16 rounded-xl bg-primary text-2xl text-primary-foreground sm:size-20 sm:text-3xl"
            />
            <div className="min-w-0 flex-1 basis-48 space-y-3">
              <h2
                id="profile-name"
                className="text-2xl leading-snug font-semibold tracking-tight text-pretty text-foreground sm:text-3xl"
              >
                {fullName}
              </h2>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{getRoleLabel(user.role)}</span>
                {profile ? (
                  <>
                    <span className="font-medium text-link">{profile.group}</span>
                    <span>{formatNumber(profile.course)} курс</span>
                  </>
                ) : null}
              </p>
            </div>
          </section>

          <section aria-labelledby="academic-heading" className="min-w-0 p-5 sm:p-8">
            <h2
              id="academic-heading"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Академические данные
            </h2>
            {profile ? (
              <AcademicDetails profile={profile} />
            ) : (
              <Alert tone="warning" title="Академические данные не найдены" className="mt-5">
                {user.role === "DEAN_EMPLOYEE"
                  ? "Для сотрудника деканата академические данные студента в этом разделе не отображаются."
                  : "Профиль не связан с учебными данными. Обратитесь в деканат, чтобы проверить сведения."}
              </Alert>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-7 rounded-b-card border-t border-border bg-background/50 p-5 sm:p-8 xl:rounded-r-card xl:rounded-bl-none xl:border-t-0 xl:border-l">
          <section aria-labelledby="contact-heading" className="min-w-0 space-y-4">
            <h2
              id="contact-heading"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Контактные данные
            </h2>
            <dl>
              <dt className="text-sm text-muted-foreground">E-mail для входа</dt>
              <dd className="mt-1.5 text-base break-all text-foreground">
                {profile?.email ?? user.email}
              </dd>
            </dl>
          </section>

          <section
            aria-labelledby="readonly-heading"
            className="space-y-3 border-t border-border pt-6"
          >
            <h2
              id="readonly-heading"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-link" />
              Только для чтения
            </h2>
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
              Учебные сведения заполняет деканат. Если заметили ошибку, обратитесь в деканат для
              исправления данных.
            </p>
            {user.role === "STUDENT" ? (
              <Link
                href="/requests"
                className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Перейти в раздел заявок
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
