"use client";

import { useId } from "react";

import { getLessonProgress } from "@/lib/ui/lesson-progress";
import { cn } from "@/lib/utils";

type LessonProgressProps = {
  startsAt: number;
  endsAt: number;
  now: number;
  cancelled?: boolean;
  onPrimary?: boolean;
  className?: string;
};

const minutesFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Native, labeled, determinate progress; its presenter owns the single real UI clock. */
export function LessonProgress({
  startsAt,
  endsAt,
  now,
  cancelled = false,
  onPrimary = false,
  className,
}: LessonProgressProps) {
  const labelId = useId();
  const progress = getLessonProgress(startsAt, endsAt, now);
  if (cancelled || !progress || now < startsAt) return null;

  const label = `Прошло ${minutesFormat.format(progress.elapsedMinutes)} мин из ${minutesFormat.format(progress.durationMinutes)}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p
        id={labelId}
        className={cn(
          "text-caption",
          onPrimary ? "text-primary-foreground/95" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <progress
        className="lesson-progress"
        data-on-primary={onPrimary ? "" : undefined}
        max={1}
        value={progress.value}
        aria-labelledby={labelId}
        aria-valuetext={`${label}. Осталось ${minutesFormat.format(progress.remainingMinutes)} мин.`}
      />
    </div>
  );
}
