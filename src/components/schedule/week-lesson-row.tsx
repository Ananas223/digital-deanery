import { ArrowRight } from "lucide-react";

import { LessonDetailsTrigger } from "@/components/schedule/lesson-details-trigger";
import type { LessonPosition } from "@/components/schedule/lesson-item";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";
import { cn } from "@/lib/utils";

type WeekLessonRowProps = { lesson: ScheduleLessonView; position?: LessonPosition };

/** A weekly comparison row; the adjacent details panel retains full change history. */
export function WeekLessonRow({ lesson, position = "planned" }: WeekLessonRowProps) {
  const current = position === "current" && !lesson.cancelled;
  const next = position === "next" && !lesson.cancelled;
  const status = lesson.cancelled ? "Отменено" : current ? "Сейчас" : next ? "Следующая" : null;
  const changes = lesson.changes.filter((change) => !change.cancellation);
  const [startTime, endTime] = lesson.timeLabel.split("–");

  return (
    <article className="min-w-0">
      <LessonDetailsTrigger
        lessonId={lesson.id}
        href={lesson.href}
        className={cn(
          "group grid min-h-11 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-lg px-2 py-3 text-start wrap-anywhere underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-x-5",
          current && "bg-primary text-primary-foreground",
        )}
      >
        <p
          className={cn(
            "w-14 min-w-max shrink-0 text-base leading-6 font-medium whitespace-nowrap tabular-nums sm:w-28",
            !current && (next ? "text-primary" : "text-foreground"),
          )}
        >
          <time dateTime={lesson.startsAtIso}>{startTime}</time>
          <span className="hidden sm:inline">–</span>
          <time
            dateTime={lesson.endsAtIso}
            className={cn(
              "block text-sm font-normal sm:inline sm:text-base sm:font-medium",
              current ? "text-primary-foreground/90" : "text-muted-foreground sm:text-foreground",
            )}
          >
            <span className="sr-only sm:hidden"> — </span>
            {endTime}
          </time>
        </p>
        <div className="min-w-0">
          <h3 className="text-xl leading-6 font-medium tracking-tight group-hover:underline">
            {status ? (
              <span
                className={cn(
                  "me-2 text-sm tracking-normal",
                  lesson.cancelled ? "text-danger" : !current && "text-primary",
                )}
              >
                {status}
                <span aria-hidden="true"> ·</span>
              </span>
            ) : null}
            {lesson.title}
          </h3>
          {changes.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-sm leading-5">
              {changes.map((change) => (
                <li key={change.key} className="min-w-0">
                  <span className={cn("font-medium", !current && "text-primary")}>
                    {change.label}
                    {change.before !== null && change.after !== null ? ": " : ""}
                  </span>
                  {change.before !== null && change.after !== null ? (
                    <>
                      <span className="sr-only">Было: </span>
                      <s
                        className={cn(
                          current ? "text-primary-foreground/85" : "text-muted-foreground",
                        )}
                      >
                        {change.before}
                      </s>
                      <ArrowRight
                        aria-hidden="true"
                        className="mx-1 inline size-3.5 align-text-bottom"
                      />
                      <span className="sr-only">Стало: </span>
                      <span className="font-medium">{change.after}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div
            className={cn(
              "mt-1.5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm leading-5",
              current ? "text-primary-foreground/95" : "text-muted-foreground",
            )}
          >
            <span>{lesson.typeLabel}</span>
            <span>{lesson.teacher}</span>
            <span>{lesson.room}</span>
            {lesson.subgroupLabel ? <span>{lesson.subgroupLabel}</span> : null}
          </div>
        </div>
      </LessonDetailsTrigger>
    </article>
  );
}
