import { Building2, ChevronRight } from "lucide-react";

import { LessonChanges } from "@/components/schedule/lesson-changes";
import { LessonDetailsTrigger } from "@/components/schedule/lesson-details-trigger";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";
import { cn } from "@/lib/utils";

export type LessonPosition = "current" | "next" | "later" | "past" | "planned";

type LessonItemProps = {
  lesson: ScheduleLessonView;
  position?: LessonPosition;
  compact?: boolean;
};

const POSITION_LABELS: Record<LessonPosition, string> = {
  current: "Сейчас",
  next: "Следующая",
  later: "Затем",
  past: "Завершилось",
  planned: "По плану",
};

export function LessonItem({ lesson, position = "planned", compact = false }: LessonItemProps) {
  const current = position === "current" && !lesson.cancelled;
  const next = position === "next" && !lesson.cancelled;

  return (
    <article className="min-w-0">
      <LessonDetailsTrigger
        lessonId={lesson.id}
        href={lesson.href}
        className={cn(
          "group block min-h-11 min-w-0 p-4 text-start wrap-anywhere underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-5",
          current
            ? "rounded-card bg-primary text-primary-foreground"
            : next
              ? "rounded-card bg-card text-foreground"
              : "border-b border-border text-foreground",
          compact && "sm:p-4",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className={cn("text-sm leading-5", !current && "text-muted-foreground")}>
            <span
              className={cn(
                "font-medium",
                next && "text-primary",
                lesson.cancelled && "text-danger",
              )}
            >
              {lesson.cancelled ? "Отменено" : POSITION_LABELS[position]}
            </span>
            <span aria-hidden="true"> · </span>
            <span>{lesson.typeLabel}</span>
          </p>
          <ChevronRight
            aria-hidden="true"
            className={cn("mt-0.5 size-4 shrink-0", !current && "text-primary")}
          />
        </div>
        <h3
          className={cn(
            "mt-2 text-xl leading-snug font-medium tracking-tight group-hover:underline sm:text-2xl",
            (current || next) && "font-semibold sm:text-[1.75rem]",
            compact && "sm:text-xl",
          )}
        >
          {lesson.title}
        </h3>
        <LessonChanges
          changes={lesson.changes}
          onPrimary={current}
          className={cn(
            "mt-4 border-t border-border pt-3",
            current && "border-primary-foreground/30",
          )}
        />
        <div
          className={cn(
            "mt-4 flex flex-col gap-x-5 gap-y-2 text-sm leading-relaxed sm:flex-row sm:flex-wrap sm:items-start",
            current ? "text-primary-foreground/95" : "text-muted-foreground",
          )}
        >
          <p className="min-w-0">{lesson.teacher}</p>
          <p className="flex min-w-0 items-start gap-2">
            <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{lesson.room}</span>
          </p>
          {lesson.subgroupLabel ? <p className="w-full">{lesson.subgroupLabel}</p> : null}
        </div>
      </LessonDetailsTrigger>
    </article>
  );
}
