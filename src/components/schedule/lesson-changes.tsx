import { ArrowRight, ArrowRightLeft, Ban } from "lucide-react";

import type { ScheduleChangeView } from "@/lib/ui/schedule-presentation";
import { cn } from "@/lib/utils";

type LessonChangesProps = {
  changes: ScheduleChangeView[];
  onPrimary?: boolean;
  compact?: boolean;
  className?: string;
};

export function LessonChanges({
  changes,
  onPrimary = false,
  compact = false,
  className,
}: LessonChangesProps) {
  if (changes.length === 0) return null;

  return (
    <ul className={cn("text-meta", compact ? "space-y-2" : "space-y-3", className)}>
      {changes.map((change) => {
        const ChangeIcon = change.cancellation ? Ban : ArrowRightLeft;

        return (
          <li key={change.key} className="min-w-0 space-y-1">
            <p
              className={cn(
                "flex items-start gap-1.5 font-medium",
                onPrimary
                  ? "text-primary-foreground"
                  : change.cancellation
                    ? "text-danger-strong"
                    : "text-link",
              )}
            >
              <ChangeIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{change.label}</span>
            </p>
            {change.before !== null && change.after !== null ? (
              <p className="flex max-w-[65ch] flex-wrap items-center gap-x-2 gap-y-1">
                <span className="sr-only">Было: </span>
                <s
                  className={cn(onPrimary ? "text-primary-foreground/90" : "text-muted-foreground")}
                >
                  {change.before}
                </s>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                <span className="sr-only">Стало: </span>
                <span className="font-medium">{change.after}</span>
              </p>
            ) : null}
            {change.reason ? (
              <p
                className={cn(
                  "max-w-[65ch] text-pretty",
                  onPrimary ? "text-primary-foreground/95" : "text-muted-foreground",
                )}
              >
                {change.reason}
              </p>
            ) : null}
            {change.remainsCancelled ? (
              <p className={onPrimary ? "text-primary-foreground" : "text-danger-strong"}>
                Занятие остаётся отменённым.
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
