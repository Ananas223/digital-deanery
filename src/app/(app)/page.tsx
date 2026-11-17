import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { HomeHeader } from "@/components/dashboard/home-header";
import { StudentOverview, StudentOverviewSkeleton } from "@/components/dashboard/student-overview";
import { TodayOverview, TodayOverviewSkeleton } from "@/components/dashboard/today-overview";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Главная",
};

/** Начальная главная: личный учебный день и профиль на существующих серверных источниках. */
export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();

  return (
    <div className="min-w-0 space-y-4 wrap-anywhere sm:space-y-6">
      <HomeHeader name={user.name} initialNow={now.getTime()} />

      {user.role === "STUDENT" ? (
        <div className="grid min-w-0 items-start gap-6 sm:gap-8 xl:grid-cols-3">
          <section aria-labelledby="today-heading" className="min-w-0 space-y-4 xl:col-span-2">
            <h2 id="today-heading" className="sr-only">
              Занятия сегодня
            </h2>

            <Suspense fallback={<TodayOverviewSkeleton />}>
              <TodayOverview userId={user.id} now={now} />
            </Suspense>

            <Link
              href="/schedule"
              className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Всё расписание
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </section>

          <aside
            aria-labelledby="student-overview-heading"
            className="min-w-0 space-y-5 border-t border-border pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-7"
          >
            <h2
              id="student-overview-heading"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Учебные сведения
            </h2>
            <Suspense fallback={<StudentOverviewSkeleton />}>
              <StudentOverview userId={user.id} />
            </Suspense>
          </aside>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert tone="info" title="Кабинет сотрудника">
            Учебное расписание на главной отображается для студентов. Личные сведения доступны в
            вашем профиле.
          </Alert>
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Открыть профиль
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        </div>
      )}
    </div>
  );
}
