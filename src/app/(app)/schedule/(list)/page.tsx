import { CalendarDays, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DayTimeline } from "@/components/schedule/day-timeline";
import { LessonDetailsProvider } from "@/components/schedule/lesson-details-provider";
import { ScheduleControls } from "@/components/schedule/schedule-controls";
import { ScheduleHeader } from "@/components/schedule/schedule-header";
import { WeekAgenda } from "@/components/schedule/week-agenda";
import { WeekContext } from "@/components/schedule/week-context";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getStudentProfile } from "@/lib/domain/profile";
import { getWeekSchedule } from "@/lib/domain/schedule";
import { lessonDetailsView } from "@/lib/ui/schedule-details";
import { scheduleLessonView } from "@/lib/ui/schedule-presentation";
import {
  parseScheduleDate,
  readScheduleContext,
  type ScheduleSearchParams,
} from "@/lib/ui/schedule-query";

export const metadata: Metadata = { title: "Расписание" };
export const dynamic = "force-dynamic";

type SchedulePageProps = { searchParams: Promise<ScheduleSearchParams> };

/** The week query remains authoritative for days, effective changes, access and week number. */
export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const user = await requireUser();
  const now = new Date();
  const context = readScheduleContext(await searchParams, now);
  const [week, profile] = await Promise.all([
    getWeekSchedule(user.id, parseScheduleDate(context.week)!),
    getStudentProfile(user.id),
  ]);
  const today = {
    ...readScheduleContext({ semesterId: context.semesterId }, now),
    view: context.view,
  };

  if (!week) {
    return (
      <div className="space-y-6">
        <PageHeader title="Расписание" className="border-0 pb-0" />
        <EmptyState
          icon={UserRound}
          title="Расписание пока недоступно"
          description="Для вашего аккаунта ещё не указан учебный профиль. Проверьте данные профиля: расписание появится после привязки к группе."
          action={
            <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
              Открыть профиль
            </Link>
          }
        />
      </div>
    );
  }

  const selected = week.days.find((day) => day.date === context.day);
  if (!selected) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Не удалось выбрать день"
        description="Откройте расписание текущей недели ещё раз."
        action={
          <Link href="/schedule" className={buttonVariants({ variant: "outline" })}>
            К текущей неделе
          </Link>
        }
      />
    );
  }

  return (
    <LessonDetailsProvider
      lessons={week.days.flatMap((day) =>
        day.lessons.map((lesson) => lessonDetailsView(lesson, context)),
      )}
    >
      <div className="mx-auto w-full max-w-[100rem] min-w-0 space-y-4 sm:space-y-7">
        <ScheduleHeader context={context} group={profile?.group} />
        {context.invalidDate ? (
          <Alert title="Дата в ссылке не распознана">
            Проверьте дату или выберите нужный день в календаре.
          </Alert>
        ) : null}
        <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-5 sm:space-y-7">
            <ScheduleControls week={week} context={context} today={today} />
            {context.view === "day" ? (
              <DayTimeline
                key={selected.date}
                context={context}
                date={selected.date}
                startsAt={selected.startsAt}
                lessons={selected.lessons.map((lesson) => scheduleLessonView(lesson, context))}
                initialNow={now.getTime()}
              />
            ) : (
              <WeekAgenda
                days={week.days.map((day) => ({
                  date: day.date,
                  startsAt: day.startsAt,
                  lessons: day.lessons.map((lesson) =>
                    scheduleLessonView(lesson, context, { compact: true }),
                  ),
                }))}
                context={context}
                initialNow={now.getTime()}
              />
            )}
          </div>
          <WeekContext week={week} context={context} />
        </div>
      </div>
    </LessonDetailsProvider>
  );
}
