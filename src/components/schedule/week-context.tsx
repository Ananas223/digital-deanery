import Link from "next/link";

import type { ScheduleWeek } from "@/lib/domain/schedule";
import { formatScheduleDate, formatScheduleTime } from "@/lib/ui/schedule-format";
import { scheduleHref, type ScheduleContext } from "@/lib/ui/schedule-query";
import { cn } from "@/lib/utils";

type WeekContextProps = { week: ScheduleWeek; context: ScheduleContext };

const lessonCount = new Intl.PluralRules("ru-RU");
function lessonCountLabel(count: number): string {
  const form = lessonCount.select(count);
  return `${count} ${form === "one" ? "занятие" : form === "few" ? "занятия" : "занятий"}`;
}

export function WeekContext({ week, context }: WeekContextProps) {
  return (
    <aside
      aria-labelledby="week-plan-heading"
      className="min-w-0 self-start border-t border-border pt-5 xl:border-s xl:border-t-0 xl:ps-6 xl:pt-0"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="week-plan-heading" className="text-lg font-medium">
          План недели
        </h2>
        <span className="text-sm text-muted-foreground">№ {week.weekNumber}</span>
      </div>
      <ol className="divide-y divide-border">
        {week.days.map((day) => {
          const scheduled = day.lessons.filter((lesson) => lesson.effective.status !== "CANCELLED");
          const first = scheduled[0];
          const lastEnd = scheduled.reduce<Date | null>(
            (end, lesson) =>
              !end || lesson.effective.endsAt > end ? lesson.effective.endsAt : end,
            null,
          );
          const selected = day.date === context.day;
          return (
            <li key={day.date}>
              <Link
                href={scheduleHref({ ...context, day: day.date }, context.view === "week")}
                aria-current={selected ? "date" : undefined}
                className="group grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-sm py-3 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <span
                  className={cn(
                    "text-sm font-medium group-hover:underline",
                    selected && "text-link",
                  )}
                >
                  {formatScheduleDate(day.startsAt, {
                    weekday: "short",
                    month: undefined,
                    year: undefined,
                  })}
                </span>
                <span className="text-end text-sm text-muted-foreground">
                  {scheduled.length === 0 ? "Занятий нет" : lessonCountLabel(scheduled.length)}
                </span>
                {first && lastEnd ? (
                  <span className="col-span-2 text-sm text-muted-foreground tabular-nums">
                    <time dateTime={first.effective.startsAt.toISOString()}>
                      {formatScheduleTime(first.effective.startsAt)}
                    </time>
                    <span aria-hidden="true">–</span>
                    <time dateTime={lastEnd.toISOString()}>{formatScheduleTime(lastEnd)}</time>
                  </span>
                ) : day.lessons.length > 0 ? (
                  <span className="col-span-2 text-sm text-danger-strong">
                    Все занятия отменены
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
