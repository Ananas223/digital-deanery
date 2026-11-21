import { cn } from "@/lib/utils";

export type LessonPosition = "current" | "next" | "later" | "past" | "planned";

const POSITION_LABELS: Record<LessonPosition, string> = {
  current: "Сейчас",
  next: "Следующая",
  later: "Затем",
  past: "Завершено",
  planned: "По плану",
};

type LessonStateLabelProps = {
  position?: LessonPosition;
  cancelled?: boolean;
  onPrimary?: boolean;
  className?: string;
};

export function LessonStateLabel({
  position = "planned",
  cancelled = false,
  onPrimary = false,
  className,
}: LessonStateLabelProps) {
  return (
    <span
      className={cn(
        "text-caption font-medium",
        onPrimary
          ? "text-primary-foreground"
          : cancelled
            ? "font-semibold text-danger-strong"
            : position === "current" || position === "next"
              ? "text-link"
              : "text-muted-foreground",
        className,
      )}
    >
      {cancelled ? "Отменено" : POSITION_LABELS[position]}
    </span>
  );
}
