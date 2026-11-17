import { CalendarDays } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { TodayRoute } from "@/components/dashboard/today-route";
import { LessonDetailsProvider } from "@/components/schedule/lesson-details-provider";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getTodaySchedule, type ScheduleDay, type ScheduleLesson } from "@/lib/domain/schedule";
import { getMoscowDateKey } from "@/lib/domain/schedule-time";
import { lessonDetailsView } from "@/lib/ui/schedule-details";
import { scheduleLessonView } from "@/lib/ui/schedule-presentation";
import { readScheduleContext } from "@/lib/ui/schedule-query";

import { OverviewError } from "./overview-error";

type TodayOverviewProps = { userId: string; now: Date };

function lessonHref(lesson: ScheduleLesson): Route {
  return `/schedule/${encodeURIComponent(lesson.id)}` as Route;
}

/** The authorized server query and projections remain here; only presentation has a live UI clock. */
export async function TodayOverview({ userId, now }: TodayOverviewProps) {
  let schedule: ScheduleDay | null;
  try {
    schedule = await getTodaySchedule(userId, now);
  } catch {
    return (
      <OverviewError
        title="Расписание не загрузилось"
        description="Попробуйте обновить расписание. Профиль и остальные разделы по-прежнему доступны."
      />
    );
  }
  if (!schedule) {
    return (
      <EmptyState
        title="Учебные данные не найдены"
        description="Расписание не связано с вашим профилем. Проверьте учебные сведения и обратитесь в деканат."
        icon={CalendarDays}
        action={
          <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
            Открыть профиль
          </Link>
        }
      />
    );
  }
  if (schedule.lessons.length === 0) {
    return (
      <EmptyState
        title="На сегодня занятий нет"
        description="Посмотрите расписание на неделю, чтобы спланировать следующие учебные дни."
        icon={CalendarDays}
        action={
          <Link href="/schedule?view=week" className={buttonVariants({ variant: "outline" })}>
            Расписание на неделю
          </Link>
        }
      />
    );
  }

  const detailsContext = readScheduleContext({}, now, schedule.startsAt);
  const details = schedule.lessons.map((lesson) => lessonDetailsView(lesson, detailsContext));
  const lessonViews = schedule.lessons.map((lesson) => ({
    ...scheduleLessonView(lesson, detailsContext),
    href: lessonHref(lesson),
  }));

  return (
    <LessonDetailsProvider lessons={details}>
      <TodayRoute
        lessons={lessonViews}
        date={getMoscowDateKey(schedule.startsAt)}
        initialNow={now.getTime()}
      />
    </LessonDetailsProvider>
  );
}

export function TodayOverviewSkeleton() {
  return (
    <div role="status" aria-label="Загружаем расписание" className="space-y-4 pl-6 sm:pl-7">
      <div
        aria-hidden="true"
        className="space-y-3 rounded-card border border-border bg-card p-4 sm:p-6"
      >
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <span className="sr-only">Загружаем расписание.</span>
    </div>
  );
}
