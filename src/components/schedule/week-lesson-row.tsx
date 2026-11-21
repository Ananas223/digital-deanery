import { Building2, ChevronRight } from "lucide-react";

import { LessonChanges } from "@/components/schedule/lesson-changes";
import { LessonDetailsTrigger } from "@/components/schedule/lesson-details-trigger";
import { LessonProgress } from "@/components/schedule/lesson-progress";
import { LessonStateLabel, type LessonPosition } from "@/components/schedule/lesson-state-label";
import { LessonStateMarker } from "@/components/schedule/lesson-state-marker";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";
import { cn } from "@/lib/utils";

type WeekLessonRowProps = { lesson: ScheduleLessonView; position?: LessonPosition; now?: number };

/** A compact comparison row; change values and reasons remain before secondary metadata. */
export function WeekLessonRow({ lesson, position = "planned", now }: WeekLessonRowProps) {
  const current = position === "current" && !lesson.cancelled;
  const next = position === "next" && !lesson.cancelled;
  const [startTime, endTime] = lesson.timeLabel.split("–");

  return (
    <article className="@container/week-route min-w-0">
      <LessonDetailsTrigger
        lessonId={lesson.id}
        href={lesson.href}
        className={cn(
          "group grid min-h-11 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-card px-2 py-3 text-start wrap-anywhere underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-x-5 @max-[18em]/week-route:grid-cols-1 @max-[18em]/week-route:gap-y-2",
          current
            ? "bg-primary text-primary-foreground hover:bg-primary/95 active:bg-primary"
            : next
              ? "bg-card text-foreground hover:bg-primary-muted active:bg-muted"
              : "text-foreground hover:bg-card/70 active:bg-card",
        )}
      >
        <div className="w-16 min-w-max shrink-0 whitespace-nowrap tabular-nums sm:w-32 @max-[18em]/week-route:w-auto @max-[18em]/week-route:min-w-0 @max-[18em]/week-route:whitespace-normal">
          <div className="flex items-center gap-1.5">
            <LessonStateMarker
              position={position}
              cancelled={lesson.cancelled}
              changed={lesson.changes.some((change) => !change.cancellation)}
              className={cn(
                current && "border-primary-foreground bg-primary-foreground text-primary-solid",
              )}
            />
            <p
              className={cn(
                "text-lesson-time @max-[18em]/week-route:flex @max-[18em]/week-route:min-w-0 @max-[18em]/week-route:flex-wrap @max-[18em]/week-route:items-baseline @max-[18em]/week-route:gap-x-1.5",
                !current && next && "text-link",
              )}
            >
              <time dateTime={lesson.startsAtIso} className="whitespace-nowrap">
                {startTime}
              </time>
              <span className="hidden whitespace-nowrap sm:inline @max-[18em]/week-route:inline">
                –<time dateTime={lesson.endsAtIso}>{endTime}</time>
              </span>
            </p>
          </div>
          <p
            className={cn(
              "ps-6 text-meta sm:hidden @max-[18em]/week-route:hidden",
              current ? "text-primary-foreground/95" : "text-muted-foreground",
            )}
          >
            <span className="sr-only">Окончание: </span>
            <time dateTime={lesson.endsAtIso}>{endTime}</time>
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <LessonStateLabel
              position={position}
              cancelled={lesson.cancelled}
              onPrimary={current}
            />
            <ChevronRight
              aria-hidden="true"
              className={cn("size-4 shrink-0", !current && "text-link")}
            />
          </div>
          <h3 className="mt-0.5 max-w-[60ch] text-lesson-title group-hover:underline">
            {lesson.title}
          </h3>
          <p className="mt-1 flex min-w-0 items-start gap-1.5 text-lesson-room">
            <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{lesson.room}</span>
          </p>
          {current && now !== undefined ? (
            <LessonProgress
              startsAt={lesson.startsAt}
              endsAt={lesson.endsAt}
              now={now}
              onPrimary
              className="mt-2 max-w-[65ch]"
            />
          ) : null}
          <LessonChanges changes={lesson.changes} compact onPrimary={current} className="mt-2" />
          <div
            className={cn(
              "mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-meta",
              current ? "text-primary-foreground/95" : "text-muted-foreground",
            )}
          >
            <span>{lesson.teacher}</span>
            <span className="text-caption">{lesson.typeLabel}</span>
            {lesson.subgroupLabel ? <span>{lesson.subgroupLabel}</span> : null}
          </div>
        </div>
      </LessonDetailsTrigger>
    </article>
  );
}
