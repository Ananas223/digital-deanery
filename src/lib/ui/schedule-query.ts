import type { Route } from "next";

import { addMoscowDays, getMoscowDateKey, startOfMoscowWeek } from "@/lib/domain/schedule-time";

export type ScheduleView = "day" | "week";
export type ScheduleContext = {
  view: ScheduleView;
  day: string;
  week: string;
  semesterId?: string;
};
export type ScheduleSearchParams = Record<string, string | string[] | undefined>;

/** Parse a calendar date at Moscow midnight, rejecting rollover and ambiguous forms. */
export function parseScheduleDate(value: string | string[] | undefined): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  if (year < 1000 || year > 9999) return null;
  const date = new Date(`${value}T00:00:00+03:00`);
  return Number.isNaN(date.getTime()) || getMoscowDateKey(date) !== value ? null : date;
}

export function readScheduleContext(
  search: ScheduleSearchParams,
  now: Date,
  defaultDay: Date = now,
): ScheduleContext & { invalidDate: boolean } {
  const requestedDay = parseScheduleDate(search.day);
  const requestedWeek = parseScheduleDate(search.week);
  const weekStart = startOfMoscowWeek(requestedWeek ?? requestedDay ?? defaultDay);
  const weekEnd = addMoscowDays(weekStart, 7);
  const candidate = requestedDay ?? defaultDay;
  const isInWeek = (date: Date) => date >= weekStart && date < weekEnd;
  const selectedDay = isInWeek(candidate) ? candidate : isInWeek(now) ? now : weekStart;

  return {
    view: search.view === "week" ? "week" : "day",
    day: getMoscowDateKey(selectedDay),
    week: getMoscowDateKey(weekStart),
    semesterId: readScheduleSemesterId(search.semesterId),
    invalidDate:
      (search.day !== undefined && !requestedDay) || (search.week !== undefined && !requestedWeek),
  };
}

function scheduleQuery(context: ScheduleContext): string {
  const query = new URLSearchParams({ view: context.view, day: context.day, week: context.week });
  if (context.semesterId) query.set("semesterId", context.semesterId);
  return query.toString();
}

export function scheduleHref(context: ScheduleContext, anchor = false): Route {
  return `/schedule?${scheduleQuery(context)}${anchor ? `#day-${context.day}` : ""}` as Route;
}

export function scheduleLessonHref(lessonId: string, context: ScheduleContext): Route {
  // Fixed app path; the only dynamic path segment is URL-encoded.
  return `/schedule/${encodeURIComponent(lessonId)}?${scheduleQuery(context)}` as Route;
}

export function shiftScheduleWeek(context: ScheduleContext, direction: -1 | 1): ScheduleContext {
  const day = parseScheduleDate(context.day)!;
  const week = parseScheduleDate(context.week)!;
  return {
    ...context,
    day: getMoscowDateKey(addMoscowDays(day, direction * 7)),
    week: getMoscowDateKey(addMoscowDays(week, direction * 7)),
  };
}

/** Preserve an opaque UI context without interpreting semester selection policy. */
export function readScheduleSemesterId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 256 ? value : undefined;
}

export function scheduleDisciplineHref(disciplineId: string, context: ScheduleContext): Route {
  const query = new URLSearchParams({ disciplineId, tab: "grades" });
  if (context.semesterId) query.set("semesterId", context.semesterId);
  return `/grades?${query.toString()}` as Route;
}
