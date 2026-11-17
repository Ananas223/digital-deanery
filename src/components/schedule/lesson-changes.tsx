import { ArrowRight } from "lucide-react";

import type { ScheduleChangeView } from "@/lib/ui/schedule-presentation";
import { cn } from "@/lib/utils";

type LessonChangesProps = {
  changes: ScheduleChangeView[];
  onPrimary?: boolean;
  className?: string;
};

export function LessonChanges({ changes, onPrimary = false, className }: LessonChangesProps) {
  if (changes.length === 0) return null;

  return (
    <ul className={cn("space-y-3 text-sm", className)}>
      {changes.map((change) => (
        <li key={change.key} className="min-w-0 space-y-1.5">
          <p
            className={cn(
              "font-medium",
              onPrimary
                ? "text-primary-foreground"
                : change.cancellation
                  ? "text-danger"
                  : "text-primary",
            )}
          >
            {change.label}
          </p>
          {change.before !== null && change.after !== null ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-relaxed">
              <span className="sr-only">Было: </span>
              <s className={cn(onPrimary ? "text-primary-foreground/85" : "text-muted-foreground")}>
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
                "leading-relaxed",
                onPrimary ? "text-primary-foreground/90" : "text-muted-foreground",
              )}
            >
              {change.reason}
            </p>
          ) : null}
          {change.remainsCancelled ? <p>Занятие остаётся отменённым.</p> : null}
        </li>
      ))}
    </ul>
  );
}
