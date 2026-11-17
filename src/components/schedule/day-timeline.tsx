"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import Link from "next/link";

import { LessonItem } from "@/components/schedule/lesson-item";
import { LessonStateMarker } from "@/components/schedule/lesson-state-marker";
import { lessonPositions, useScheduleClock } from "@/components/schedule/use-schedule-clock";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { addMoscowDays, getMoscowDateKey } from "@/lib/domain/schedule-time";
import { formatScheduleDayHeading, formatScheduleTime } from "@/lib/ui/schedule-format";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";
import { readScheduleContext, scheduleHref, type ScheduleContext } from "@/lib/ui/schedule-query";
import { cn } from "@/lib/utils";

type DayTimelineProps = {
  context: ScheduleContext;
  date: string;
  startsAt: Date;
  lessons: ScheduleLessonView[];
  initialNow: number;
};

export function DayTimeline({ context, date, startsAt, lessons, initialNow }: DayTimelineProps) {
  const now = useScheduleClock(initialNow);
  const positions = lessonPositions(lessons, date, now);
  const isToday = date === getMoscowDateKey(new Date(now));
  const hasUpcoming = lessons.some((lesson) => !lesson.cancelled && lesson.endsAt > now);
  const completed = lessons.some((lesson) => !lesson.cancelled) && !hasUpcoming;
  const tomorrow = readScheduleContext(
    { semesterId: context.semesterId },
    new Date(now),
    addMoscowDays(new Date(now), 1),
  );
  const today = readScheduleContext({ semesterId: context.semesterId }, new Date(now));

  return (
    <section
      aria-labelledby={`day-${date}`}
      className="@container/day-route min-w-0 space-y-4 sm:space-y-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`day-${date}`} className="scroll-mt-6 text-xl font-medium sm:text-2xl">
          {formatScheduleDayHeading(startsAt)}
        </h2>
        <p className="flex items-center gap-1.5 text-meta text-muted-foreground tabular-nums">
          <Clock3 aria-hidden="true" className="size-3.5" />
          <time dateTime={new Date(now).toISOString()}>{formatScheduleTime(now)}</time> МСК
        </p>
      </div>
      {isToday && lessons.length > 0 && !hasUpcoming ? (
        <div role="status" className="space-y-1 text-sm">
          <p className="font-medium">
            {completed ? "Занятия на сегодня закончились" : "Все занятия на сегодня отменены"}
          </p>
          <Link
            href={scheduleHref(tomorrow)}
            className="inline-flex min-h-11 items-center gap-2 rounded-sm font-medium text-link underline underline-offset-4"
          >
            Расписание на завтра
          </Link>
        </div>
      ) : null}
      {lessons.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={isToday ? "Сегодня занятий нет" : "На этот день занятий нет"}
          description="В расписании вашей группы на выбранную дату нет занятий. Можно посмотреть другой день или неделю целиком."
          action={
            <Link
              href={scheduleHref(isToday ? tomorrow : today)}
              className={buttonVariants({ variant: "outline" })}
            >
              {isToday ? "Посмотреть завтра" : "К сегодняшнему дню"}
            </Link>
          }
        />
      ) : (
        <ol aria-label="Занятия по времени" className="relative">
          {lessons.map((lesson, index) => {
            const position = positions.get(lesson.id)!;
            const emphasized = !lesson.cancelled && (position === "current" || position === "next");
            const [startTime, endTime] = lesson.timeLabel.split("–");
            return (
              <li
                key={lesson.id}
                className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] gap-x-2 pb-4 last:pb-0 sm:gap-x-3 sm:pb-5 @max-[18em]/day-route:grid-cols-[auto_minmax(0,1fr)]"
              >
                <div
                  className={cn(
                    "w-12 min-w-max pt-4 text-end whitespace-nowrap tabular-nums sm:w-16 sm:pt-5 @max-[18em]/day-route:col-start-2 @max-[18em]/day-route:row-start-1 @max-[18em]/day-route:flex @max-[18em]/day-route:w-auto @max-[18em]/day-route:min-w-0 @max-[18em]/day-route:flex-wrap @max-[18em]/day-route:items-baseline @max-[18em]/day-route:gap-x-2 @max-[18em]/day-route:ps-4 @max-[18em]/day-route:text-start @max-[18em]/day-route:whitespace-normal",
                    emphasized ? "text-link" : "text-muted-foreground",
                  )}
                >
                  <p className="text-lesson-time whitespace-nowrap">
                    <span className="sr-only">Начало: </span>
                    <time dateTime={lesson.startsAtIso}>{startTime}</time>
                  </p>
                  <p className="mt-0.5 text-meta whitespace-nowrap @max-[18em]/day-route:mt-0">
                    <span className="sr-only">Окончание: </span>
                    <time dateTime={lesson.endsAtIso}>{endTime}</time>
                  </p>
                </div>
                <div
                  aria-hidden="true"
                  className="relative w-4 @max-[18em]/day-route:col-start-1 @max-[18em]/day-route:row-span-2 @max-[18em]/day-route:row-start-1"
                >
                  <span
                    className={cn(
                      "absolute start-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-border forced-colors:bg-current",
                      index === 0 && "top-6",
                      index === lessons.length - 1 && "bottom-auto h-6",
                      lessons.length === 1 && "hidden",
                    )}
                  />
                  <LessonStateMarker
                    position={position}
                    cancelled={lesson.cancelled}
                    changed={lesson.changes.some((change) => !change.cancellation)}
                    className="absolute start-1/2 top-6 -translate-x-1/2 -translate-y-1/2"
                  />
                </div>
                <div className="min-w-0 @max-[18em]/day-route:col-start-2 @max-[18em]/day-route:row-start-2">
                  <LessonItem lesson={lesson} position={position} now={now} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
