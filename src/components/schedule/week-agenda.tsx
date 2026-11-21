"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { WeekLessonRow } from "@/components/schedule/week-lesson-row";
import { lessonPositions, useScheduleClock } from "@/components/schedule/use-schedule-clock";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMoscowDateKey } from "@/lib/domain/schedule-time";
import { formatScheduleDayHeading } from "@/lib/ui/schedule-format";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";
import { readScheduleContext, scheduleHref, type ScheduleContext } from "@/lib/ui/schedule-query";
import { cn } from "@/lib/utils";

export type WeekAgendaDay = { date: string; startsAt: Date; lessons: ScheduleLessonView[] };

type WeekAgendaProps = { days: WeekAgendaDay[]; context: ScheduleContext; initialNow: number };

export function WeekAgenda({ days, context, initialNow }: WeekAgendaProps) {
  const now = useScheduleClock(initialNow);
  const today = getMoscowDateKey(new Date(now));
  const empty = days.every((day) => day.lessons.length === 0);
  return (
    <div className="min-w-0 space-y-5">
      {empty ? (
        <EmptyState
          icon={CalendarDays}
          title="На неделе занятий нет"
          description="Для вашей группы на эту неделю занятия не указаны. Можно перейти к текущей неделе или выбрать другой период."
          action={
            <Link
              href={scheduleHref({
                ...readScheduleContext({ semesterId: context.semesterId }, new Date(now)),
                view: "week",
              })}
              className={buttonVariants({ variant: "outline" })}
            >
              К текущей неделе
            </Link>
          }
        />
      ) : null}
      {days.map((day) => {
        const positions = lessonPositions(day.lessons, day.date, now);
        return (
          <section key={day.date} aria-labelledby={`day-${day.date}`} className="min-w-0 space-y-1">
            <div
              className={cn(
                "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2",
                day.date === context.day && "border-link",
              )}
            >
              <h2 id={`day-${day.date}`} className="scroll-mt-6 text-lg font-medium">
                {formatScheduleDayHeading(day.startsAt)}
                {day.date === today ? (
                  <span className="ms-2 text-sm font-normal text-link">Сегодня</span>
                ) : null}
              </h2>
              <Link
                href={scheduleHref({ ...context, view: "day", day: day.date })}
                className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={`Открыть день: ${formatScheduleDayHeading(day.startsAt)}`}
              >
                Открыть день
              </Link>
            </div>
            {day.lessons.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Занятий нет</p>
            ) : (
              <ol
                aria-label={`Занятия: ${formatScheduleDayHeading(day.startsAt)}`}
                className="divide-y divide-border"
              >
                {day.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <WeekLessonRow lesson={lesson} position={positions.get(lesson.id)} now={now} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
