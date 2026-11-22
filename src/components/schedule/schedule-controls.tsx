import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { ScheduleWeek } from "@/lib/domain/schedule";
import { formatScheduleDate, formatScheduleWeekRange } from "@/lib/ui/schedule-format";
import { scheduleHref, shiftScheduleWeek, type ScheduleContext } from "@/lib/ui/schedule-query";
import { cn } from "@/lib/utils";

type ScheduleControlsProps = {
  week: ScheduleWeek;
  context: ScheduleContext;
  today: ScheduleContext;
};

export function ScheduleViewLinks({
  context,
  compact = false,
}: {
  context: ScheduleContext;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="Вид расписания"
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-lg border border-border",
        compact ? "p-0.5" : "p-1",
      )}
    >
      {(["day", "week"] as const).map((view) => (
        <Link
          key={view}
          href={scheduleHref({ ...context, view })}
          aria-current={view === context.view ? "page" : undefined}
          className={cn(
            buttonVariants({ variant: view === context.view ? "primary" : "ghost" }),
            "rounded-md",
            compact ? "min-w-11 px-2" : "min-w-24 px-4",
          )}
        >
          {view === "day" ? "День" : "Неделя"}
        </Link>
      ))}
    </nav>
  );
}

export function ScheduleControls({ week, context, today }: ScheduleControlsProps) {
  const first = week.days[0]!;
  const last = week.days[week.days.length - 1]!;
  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex flex-col gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1 sm:block sm:space-y-1">
          <p className="text-base font-medium">
            {formatScheduleWeekRange(first.startsAt, last.startsAt)}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="sm:hidden">Неделя </span>
            <span className="hidden sm:inline">Учебная неделя </span>
            {week.weekNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:contents">
          <div className="flex items-center gap-2 sm:hidden">
            <ScheduleViewLinks context={context} compact />
            <Link
              href={`/api/schedule/export?week=${context.week}` as Route}
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download aria-hidden="true" className="size-4" />В календарь
            </Link>
          </div>
          <nav aria-label="Переход по неделям" className="flex flex-wrap items-center gap-1">
            <Link
              href={scheduleHref(shiftScheduleWeek(context, -1))}
              aria-label="Предыдущая неделя"
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href={scheduleHref(shiftScheduleWeek(context, 1))}
              aria-label="Следующая неделя"
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href={scheduleHref(today)}
              aria-label={
                context.view === "week"
                  ? "Вернуться к текущей неделе"
                  : "Показать расписание на сегодня"
              }
              className={cn(buttonVariants({ variant: "ghost" }), "px-3")}
            >
              {context.view === "week" ? "К текущей" : "Сегодня"}
            </Link>
          </nav>
        </div>
      </div>
      <nav aria-label="Дни выбранной недели" className="flex flex-wrap">
        {week.days.map((day) => {
          const selected = day.date === context.day;
          const isToday = day.date === today.day;
          return (
            <Link
              key={day.date}
              href={scheduleHref({ ...context, day: day.date }, context.view === "week")}
              aria-description={`${isToday ? "Сегодня, " : ""}${formatScheduleDate(day.startsAt, { weekday: "long" })}`}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "flex min-h-14 min-w-max flex-1 basis-11 flex-col items-center justify-center gap-0 rounded-lg border border-transparent px-1 py-0.5 text-center transition-colors hover:bg-primary-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-16 sm:gap-0.5 sm:py-2",
                selected && "border-link bg-card text-link",
              )}
            >
              <span className={cn("text-sm", selected ? "text-link" : "text-muted-foreground")}>
                {formatScheduleDate(day.startsAt, {
                  weekday: "short",
                  day: undefined,
                  month: undefined,
                  year: undefined,
                })}
              </span>
              <span
                className={cn(
                  "text-lg tabular-nums",
                  isToday && "font-semibold underline decoration-link underline-offset-4",
                )}
              >
                {formatScheduleDate(day.startsAt, {
                  day: "numeric",
                  month: undefined,
                  year: undefined,
                })}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
