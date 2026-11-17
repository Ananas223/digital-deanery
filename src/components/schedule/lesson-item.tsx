import { Building2, ChevronRight } from "lucide-react";

import { LessonChanges } from "@/components/schedule/lesson-changes";
import { LessonDetailsTrigger } from "@/components/schedule/lesson-details-trigger";
import { LessonProgress } from "@/components/schedule/lesson-progress";
import { LessonStateLabel, type LessonPosition } from "@/components/schedule/lesson-state-label";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";
import { cn } from "@/lib/utils";

export type { LessonPosition } from "@/components/schedule/lesson-state-label";

type LessonItemProps = {
  lesson: ScheduleLessonView;
  position?: LessonPosition;
  compact?: boolean;
  now?: number;
};

export function LessonItem({
  lesson,
  position = "planned",
  compact = false,
  now,
}: LessonItemProps) {
  const current = position === "current" && !lesson.cancelled;
  const next = position === "next" && !lesson.cancelled;

  return (
    <article className="min-w-0">
      <LessonDetailsTrigger
        lessonId={lesson.id}
        href={lesson.href}
        className={cn(
          "group block min-h-11 min-w-0 rounded-card p-4 text-start wrap-anywhere underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-5",
          current
            ? "bg-primary text-primary-foreground hover:bg-primary/95 active:bg-primary"
            : next
              ? "border border-border bg-card text-foreground hover:border-link active:bg-primary-muted"
              : "border-b border-border text-foreground hover:bg-card/70 active:bg-card",
          compact && "sm:p-4",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <LessonStateLabel position={position} cancelled={lesson.cancelled} onPrimary={current} />
          <ChevronRight
            aria-hidden="true"
            className={cn("size-4 shrink-0", !current && "text-link")}
          />
        </div>
        <h3 className="mt-1 max-w-[60ch] text-lesson-title group-hover:underline">
          {lesson.title}
        </h3>
        <p className="mt-2 flex min-w-0 items-start gap-2 text-lesson-room">
          <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{lesson.room}</span>
        </p>
        {current && now !== undefined ? (
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
          onPrimary={current}
          className={cn(
            "mt-3 border-t border-border pt-3",
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
    </article>
  );
}
