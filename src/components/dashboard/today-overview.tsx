import { ArrowRight, Building2, CalendarDays, UserRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { LessonDetailsProvider } from "@/components/schedule/lesson-details-provider";
import { LessonDetailsTrigger } from "@/components/schedule/lesson-details-trigger";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLessonChangeLabel,
  getLessonTypeLabel,
  getTodaySchedule,
  type ScheduleDay,
  type ScheduleLesson,
} from "@/lib/domain/schedule";
import {
  formatScheduleRoom,
  formatScheduleTime,
  formatScheduleTimeRange,
} from "@/lib/ui/schedule-format";
import { lessonDetailsView } from "@/lib/ui/schedule-details";
import { readScheduleContext } from "@/lib/ui/schedule-query";
import { cn } from "@/lib/utils";

import { OverviewError } from "./overview-error";

type TodayOverviewProps = {
  userId: string;
  now: Date;
};

function lessonHref(lesson: ScheduleLesson): Route {
  return `/schedule/${encodeURIComponent(lesson.id)}` as Route;
}

function LessonChanges({ lesson, current }: { lesson: ScheduleLesson; current: boolean }) {
  if (lesson.changes.length === 0) {
    return null;
  }

  const types = [...new Set(lesson.changes.map((change) => change.type))];
  const timeChanged =
    lesson.original.startsAt.getTime() !== lesson.effective.startsAt.getTime() ||
    lesson.original.endsAt.getTime() !== lesson.effective.endsAt.getTime();

  return (
    <div
      className={cn(
        "space-y-2 border-t pt-4 text-sm",
        current ? "border-primary-foreground/30" : "border-border",
      )}
    >
      <p className={cn("font-medium", current ? "text-primary-foreground" : "text-primary")}>
        {types.map(getLessonChangeLabel).join(" · ")}
      </p>
      {timeChanged ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
          <s>{formatScheduleTimeRange(lesson.original.startsAt, lesson.original.endsAt)}</s>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          <span className="font-medium">
            {formatScheduleTimeRange(lesson.effective.startsAt, lesson.effective.endsAt)}
          </span>
        </p>
      ) : null}
      <ul
        className={cn(
          "space-y-1 text-pretty",
          current ? "text-primary-foreground/90" : "text-muted-foreground",
        )}
      >
        {lesson.changes
          .filter((change) => change.reason)
          .map((change) => (
            <li key={change.id}>{change.reason}</li>
          ))}
      </ul>
    </div>
  );
}

function NearestLesson({ lesson, current }: { lesson: ScheduleLesson; current: boolean }) {
  const effective = lesson.effective;

  return (
    <div className="relative before:absolute before:top-8 before:-left-5 before:size-2 before:rounded-full before:border before:border-primary before:bg-primary sm:before:-left-6">
      <LessonDetailsTrigger
        lessonId={lesson.id}
        href={lessonHref(lesson)}
        className={cn(
          "block min-w-0 space-y-5 rounded-card border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-7",
          current
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/95"
            : "border-border bg-card text-foreground hover:border-primary",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-4",
            current ? "border-primary-foreground/30" : "border-border",
          )}
        >
          <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <time
              dateTime={effective.startsAt.toISOString()}
              className="text-3xl leading-tight font-semibold tracking-tight"
            >
              {formatScheduleTime(effective.startsAt)}
            </time>
            <span
              className={cn(
                "text-lg",
                current ? "text-primary-foreground/90" : "text-muted-foreground",
              )}
            >
              –
              <time dateTime={effective.endsAt.toISOString()}>
                {formatScheduleTime(effective.endsAt)}
              </time>
            </span>
          </p>
          <span
            className={cn(
              "rounded-sm px-2 py-1 text-sm font-medium",
              current
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-primary-muted text-primary",
            )}
          >
            {current ? "Сейчас" : "Следующая пара"}
          </span>
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl leading-snug font-semibold tracking-tight text-pretty sm:text-3xl">
            {effective.discipline.name}
          </h3>
          <p
            className={cn(
              "text-sm",
              current ? "text-primary-foreground/90" : "text-muted-foreground",
            )}
          >
            {getLessonTypeLabel(lesson.type)}
          </p>
        </div>

        <LessonChanges lesson={lesson} current={current} />

        <div
          className={cn(
            "flex flex-wrap gap-x-6 gap-y-2 text-sm",
            current ? "text-primary-foreground/90" : "text-muted-foreground",
          )}
        >
          <p className="flex min-w-0 items-start gap-2">
            <UserRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{effective.teacher.fullName}</span>
          </p>
          <p className="flex min-w-0 items-start gap-2">
            <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{formatScheduleRoom(effective.room)}</span>
          </p>
        </div>
        <p className="flex min-h-6 items-center justify-between gap-3 text-sm font-medium">
          Открыть занятие
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </p>
      </LessonDetailsTrigger>
    </div>
  );
}

function TodayLessonList({ lessons, now }: { lessons: ScheduleLesson[]; now: Date }) {
  if (lessons.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-border">
      {lessons.map((lesson) => {
        const cancelled = lesson.effective.status === "CANCELLED";
        const finished = lesson.effective.endsAt.getTime() <= now.getTime();
        const status = cancelled ? "Отменено" : finished ? "Завершено" : "Затем";

        return (
          <li
            key={lesson.id}
            className="relative min-w-0 before:absolute before:top-6 before:-left-5 before:size-2 before:rounded-full before:border before:border-primary before:bg-background sm:before:-left-6"
          >
            <LessonDetailsTrigger
              lessonId={lesson.id}
              href={lessonHref(lesson)}
              className="block min-w-0 space-y-2 rounded-md py-4 transition-colors hover:bg-card/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:py-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-foreground tabular-nums">
                  {formatScheduleTimeRange(lesson.effective.startsAt, lesson.effective.endsAt)}
                </span>
                <span className={cancelled ? "text-danger-strong" : "text-muted-foreground"}>
                  {status}
                </span>
              </div>
              <h4 className="text-base leading-snug font-medium text-pretty text-foreground sm:text-lg">
                {lesson.effective.discipline.name}
              </h4>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{getLessonTypeLabel(lesson.type)}</span>
                {lesson.changes.length > 0 && !cancelled ? (
                  <span className="text-primary">Есть изменения</span>
                ) : null}
                <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-primary" />
              </p>
              {cancelled
                ? lesson.changes
                    .filter((change) => change.type === "CANCELLATION" && change.reason)
                    .map((change) => (
                      <p key={change.id} className="text-sm text-pretty text-muted-foreground">
                        {change.reason}
                      </p>
                    ))
                : null}
            </LessonDetailsTrigger>
          </li>
        );
      })}
    </ul>
  );
}

/** Независимый блок читает только расписание пользователя из проверенной серверной сессии. */
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

  const activeLessons = schedule.lessons.filter(
    (lesson) => lesson.effective.status !== "CANCELLED",
  );
  const current = activeLessons.find(
    (lesson) =>
      lesson.effective.startsAt.getTime() <= now.getTime() &&
      lesson.effective.endsAt.getTime() > now.getTime(),
  );
  const next = activeLessons.find((lesson) => lesson.effective.startsAt.getTime() > now.getTime());
  const nearest = current ?? next;
  const remainingLessons = schedule.lessons.filter((lesson) => lesson.id !== nearest?.id);
  const detailsContext = readScheduleContext({}, now, schedule.startsAt);
  const details = schedule.lessons.map((lesson) => lessonDetailsView(lesson, detailsContext));

  return (
    <LessonDetailsProvider lessons={details}>
      <div className="relative space-y-6 pl-5 before:absolute before:inset-y-4 before:left-1 before:w-px before:bg-border sm:pl-6">
        {nearest ? (
          <NearestLesson lesson={nearest} current={Boolean(current)} />
        ) : (
          <div className="space-y-2 rounded-card border border-border bg-card p-5 sm:p-6">
            <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {activeLessons.length > 0 ? "На сегодня всё" : "Занятия на сегодня отменены"}
            </h3>
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
              {activeLessons.length > 0
                ? "Занятия завершились. В расписании можно посмотреть следующие учебные дни."
                : "Проверьте изменения ниже. Расписание на неделю доступно в разделе «Расписание»."}
            </p>
            <Link
              href="/schedule?view=week"
              className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm font-medium text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Посмотреть неделю
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </div>
        )}

        {remainingLessons.length > 0 ? (
          <section aria-labelledby="today-list-heading" className="space-y-1">
            <h3 id="today-list-heading" className="text-sm font-medium text-muted-foreground">
              {nearest ? "Остальные занятия сегодня" : "Сегодня в расписании"}
            </h3>
            <TodayLessonList lessons={remainingLessons} now={now} />
          </section>
        ) : null}
      </div>
    </LessonDetailsProvider>
  );
}

export function TodayOverviewSkeleton() {
  return (
    <div role="status" aria-label="Загружаем расписание" className="space-y-4 pl-5 sm:pl-6">
      <div
        aria-hidden="true"
        className="space-y-5 rounded-card border border-border bg-card p-5 sm:p-7"
      >
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <span className="sr-only">Загружаем расписание.</span>
    </div>
  );
}
