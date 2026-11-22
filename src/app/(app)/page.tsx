import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AssistantHomeCard } from "@/components/assistant/assistant-home-card";
import {
  DashboardOverview,
  DashboardOverviewSkeleton,
  DashboardQuickActions,
} from "@/components/dashboard/dashboard-overview";
import { HomeHeader } from "@/components/dashboard/home-header";
import { MorningBrief, MorningBriefSkeleton } from "@/components/dashboard/morning-brief";
import { TodayOverview, TodayOverviewSkeleton } from "@/components/dashboard/today-overview";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Главная" };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const now = new Date();

  return (
    <div className="min-w-0 space-y-4 wrap-anywhere sm:space-y-6">
      <HomeHeader name={user.name} initialNow={now.getTime()} />
      {user.role === "STUDENT" ? (
        <>
          <section aria-labelledby="morning-brief-heading" className="min-w-0 space-y-3">
            <h2 id="morning-brief-heading" className="text-lg leading-6 font-semibold">
              Утренний бриф
            </h2>
            <Suspense fallback={<MorningBriefSkeleton />}>
              <MorningBrief userId={user.id} now={now} />
            </Suspense>
          </section>
          <div className="grid min-w-0 items-start gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
            <section aria-labelledby="today-heading" className="min-w-0 space-y-4">
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
              <DashboardQuickActions />
            </section>
            <aside aria-label="Сводка кабинета" className="min-w-0 space-y-4">
              <div className="hidden xl:block">
                <AssistantHomeCard />
              </div>
              <Suspense fallback={<DashboardOverviewSkeleton />}>
                <DashboardOverview userId={user.id} now={now} />
              </Suspense>
            </aside>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <Alert tone="info" title="Кабинет сотрудника">
            Откройте очередь обращений, чтобы проверить заявки студентов.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Link href="/requests" className={buttonVariants()}>
              Очередь заявок
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
              Открыть профиль
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
