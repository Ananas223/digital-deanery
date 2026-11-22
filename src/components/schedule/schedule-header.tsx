import { Download } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ScheduleViewLinks } from "@/components/schedule/schedule-controls";
import { buttonVariants } from "@/components/ui/button";
import type { ScheduleContext } from "@/lib/ui/schedule-query";

type ScheduleHeaderProps = { context: ScheduleContext; group?: string };

export function ScheduleHeader({ context, group }: ScheduleHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 sm:block sm:space-y-2">
        <h1 className="text-page-title font-semibold tracking-tight text-balance">Расписание</h1>
        {group ? (
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            <span className="sr-only sm:not-sr-only">Группа </span>
            {group}
          </p>
        ) : null}
      </div>
      <div className="hidden min-w-0 flex-wrap items-center gap-2 sm:flex">
        <ScheduleViewLinks context={context} />
        <Link
          href={`/api/schedule/export?week=${context.week}` as Route}
          download
          className={buttonVariants({ variant: "outline" })}
        >
          <Download aria-hidden="true" className="size-4" />В календарь
        </Link>
      </div>
    </header>
  );
}
