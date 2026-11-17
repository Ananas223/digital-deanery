import { ArrowRight, Check, X } from "lucide-react";

import type { LessonPosition } from "@/components/schedule/lesson-state-label";
import { cn } from "@/lib/utils";

type LessonStateMarkerProps = {
  position?: LessonPosition;
  cancelled?: boolean;
  changed?: boolean;
  className?: string;
};

/** One route node; temporal position and change history remain separate display inputs. */
export function LessonStateMarker({
  position = "planned",
  cancelled = false,
  changed = false,
  className,
}: LessonStateMarkerProps) {
  const current = position === "current" && !cancelled;
  const past = position === "past" && !cancelled;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-link bg-card text-link forced-colors:border-current",
        current && "bg-primary text-primary-foreground",
        past && "border-muted-foreground bg-background text-muted-foreground",
        cancelled && "border-danger-strong bg-danger-muted text-danger-strong",
        className,
      )}
    >
      {cancelled ? (
        <X className="size-2.5" strokeWidth={2.5} />
      ) : past ? (
        <Check className="size-2.5" strokeWidth={2.5} />
      ) : changed ? (
        <ArrowRight className="size-2.5" strokeWidth={2.5} />
      ) : current ? (
        <span className="size-1.5 rounded-full bg-current forced-colors:bg-current" />
      ) : null}
    </span>
  );
}
