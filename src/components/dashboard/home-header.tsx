"use client";

import { getHomeGreeting } from "@/components/dashboard/home-greeting";
import { useScheduleClock } from "@/components/schedule/use-schedule-clock";
import { formatDate, formatDateTime, getFirstName } from "@/lib/format";

type HomeHeaderProps = {
  name: string;
  initialNow: number;
};

/** A personal heading and one compact Moscow date/clock, ready on the server's first frame. */
export function HomeHeader({ name, initialNow }: HomeHeaderProps) {
  const now = useScheduleClock(initialNow);
  const iso = new Date(now).toISOString();
  const date = formatDate(now, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: undefined,
  });
  const time = formatDateTime(now, { day: undefined, month: undefined, year: undefined });

  return (
    <header className="min-w-0 space-y-2 border-b border-border pb-3 sm:pb-5">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance wrap-anywhere text-foreground sm:text-4xl">
        {getHomeGreeting(now)}, <span className="text-link">{getFirstName(name)}</span>
      </h1>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-meta text-muted-foreground tabular-nums">
        <time dateTime={iso}>{date}</time>
        <span className="inline-flex items-baseline gap-2">
          <span aria-hidden="true">·</span>
          <time dateTime={iso} className="font-medium text-link">
            {time}
          </time>
          <span>МСК</span>
        </span>
      </div>
    </header>
  );
}
