"use client";

import { ArrowRight, Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LessonChanges } from "@/components/schedule/lesson-changes";
import { useLessonDetails } from "@/components/schedule/lesson-details-provider";
import { LessonDetailsTrigger } from "@/components/schedule/lesson-details-trigger";
import { LessonProgress } from "@/components/schedule/lesson-progress";
import { LessonStateLabel, type LessonPosition } from "@/components/schedule/lesson-state-label";
import { LessonStateMarker } from "@/components/schedule/lesson-state-marker";
import { lessonPositions, useScheduleClock } from "@/components/schedule/use-schedule-clock";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";
import { cn } from "@/lib/utils";

type TodayRouteProps = { lessons: ScheduleLessonView[]; date: string; initialNow: number };

export function orderLessonIds(
  lessons: Pick<ScheduleLessonView, "id">[],
  nearestId?: string,
): string[] {
  const ids = lessons.map((lesson) => lesson.id);
  return nearestId && ids.includes(nearestId)
    ? [nearestId, ...ids.filter((id) => id !== nearestId)]
    : ids;
}

function HomeLesson({
  lesson,
  position,
  prominent,
  now,
}: {
  lesson: ScheduleLessonView;
  position: LessonPosition;
  prominent: boolean;
  now: number;
}) {
  const current = position === "current" && !lesson.cancelled;
  const next = position === "next" && !lesson.cancelled;
  const [startTime, endTime] = lesson.timeLabel.split("–");

  return (
    <li className="relative min-w-0">
      <LessonStateMarker
        position={position}
        cancelled={lesson.cancelled}
        changed={lesson.changes.some((change) => !change.cancellation)}
        className={cn("absolute top-5 -left-6 sm:-left-7", prominent && "sm:top-6")}
      />
      <LessonDetailsTrigger
        lessonId={lesson.id}
        href={lesson.href}
        className={cn(
          "group block min-h-11 min-w-0 rounded-card border p-4 text-start wrap-anywhere underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          prominent && "sm:p-6",
          current
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/95 active:bg-primary"
            : next
              ? "border-border bg-card text-foreground hover:border-link active:bg-primary-muted"
              : "border-transparent text-foreground hover:bg-card/70 active:bg-card",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p
            className={cn(
              "flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-lesson-time",
              next && "text-link",
            )}
          >
            <time dateTime={lesson.startsAtIso} className="whitespace-nowrap">
              {startTime}
            </time>
            <span
              className={cn(
                "text-meta whitespace-nowrap",
                current ? "text-primary-foreground/95" : "text-muted-foreground",
              )}
            >
              – <time dateTime={lesson.endsAtIso}>{endTime}</time>
            </span>
          </p>
          <span className="flex items-center gap-2">
            <LessonStateLabel
              position={position}
              cancelled={lesson.cancelled}
              onPrimary={current}
            />
            <ChevronRight
              aria-hidden="true"
              className={cn("size-4 shrink-0", !current && "text-link")}
            />
          </span>
        </div>
        <h3 className="mt-2 max-w-[60ch] text-lesson-title group-hover:underline">
          {lesson.title}
        </h3>
        <p className="mt-2 flex min-w-0 items-start gap-2 text-lesson-room">
          <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{lesson.room}</span>
        </p>
        {current ? (
          <LessonProgress
            startsAt={lesson.startsAt}
            endsAt={lesson.endsAt}
            now={now}
            onPrimary
            className="mt-3 max-w-[65ch]"
          />
        ) : null}
        <LessonChanges
          changes={lesson.changes}
          compact={!prominent}
          onPrimary={current}
          className={cn(
            "mt-3",
            prominent && "border-t border-border pt-3",
            current && "border-primary-foreground/30",
          )}
        />
        <div
          className={cn(
            "mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-meta",
            current ? "text-primary-foreground/95" : "text-muted-foreground",
          )}
        >
          <p className="min-w-0">{lesson.teacher}</p>
          <p className="text-caption">{lesson.typeLabel}</p>
          {lesson.subgroupLabel ? <p className="w-full">{lesson.subgroupLabel}</p> : null}
        </div>
      </LessonDetailsTrigger>
    </li>
  );
}

/** One live clock and one keyed list preserve the originating anchors across lesson boundaries. */
export function TodayRoute({ lessons, date, initialNow }: TodayRouteProps) {
  const now = useScheduleClock(initialNow);
  const positions = lessonPositions(lessons, date, now);
  const nearest =
    lessons.find((lesson) => positions.get(lesson.id) === "current") ??
    lessons.find((lesson) => positions.get(lesson.id) === "next");
  const panelActive = useLessonDetails()?.panelActive ?? false;
  const [focusWithin, setFocusWithin] = useState(false);
  const desiredOrder = orderLessonIds(lessons, nearest?.id);
  const [displayOrder, setDisplayOrder] = useState(desiredOrder);
  if (!panelActive && !focusWithin && displayOrder.join("\0") !== desiredOrder.join("\0")) {
    setDisplayOrder(desiredOrder);
  }
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const orderedLessons = [
    ...displayOrder.filter((id) => byId.has(id)).map((id) => byId.get(id)!),
    ...lessons.filter((lesson) => !displayOrder.includes(lesson.id)),
  ];
  const allCancelled = lessons.every((lesson) => lesson.cancelled);

  return (
    <div className="min-w-0 space-y-4">
      {!nearest ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
          <h3 className="text-meta font-medium text-foreground">
            {allCancelled ? "Все занятия отменены" : "На сегодня всё"}
          </h3>
          <Link
            href="/schedule?view=week"
            className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-meta font-medium text-link underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Посмотреть неделю
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        </div>
      ) : null}
      <ol
        aria-label="Занятия сегодня"
        className="relative space-y-3 pl-6 before:absolute before:inset-y-4 before:left-2 before:w-px before:bg-border sm:pl-7 before:forced-colors:bg-current"
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
        }}
      >
        {orderedLessons.map((lesson) => (
          <HomeLesson
            key={lesson.id}
            lesson={lesson}
            position={positions.get(lesson.id)!}
            prominent={Boolean(nearest) && lesson.id === displayOrder[0]}
            now={now}
          />
        ))}
      </ol>
    </div>
  );
}
