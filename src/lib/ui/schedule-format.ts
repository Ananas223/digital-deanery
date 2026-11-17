import type { ScheduleRoom } from "@/lib/domain/schedule-changes";
import { formatDate, formatDateTime } from "@/lib/format";

/** Schedule copy always uses Moscow, including when the browser uses another zone. */
export function formatScheduleDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return formatDate(value, {
    day: "numeric",
    month: "long",
    ...options,
    timeZone: "Europe/Moscow",
  });
}

export function formatScheduleTime(value: Date | string | number): string {
  return formatDateTime(value, { day: undefined, month: undefined, year: undefined });
}

export function formatScheduleTimeRange(startsAt: Date, endsAt: Date): string {
  return `${formatScheduleTime(startsAt)}–${formatScheduleTime(endsAt)}`;
}

export function formatScheduleDayHeading(value: Date): string {
  const label = formatScheduleDate(value, { weekday: "long", year: undefined });
  return label.charAt(0).toLocaleUpperCase("ru-RU") + label.slice(1);
}

export function formatScheduleWeekRange(first: Date, last: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).formatRange(first, last);
}

export function formatScheduleRoom(room: ScheduleRoom): string {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
  const number = normalize(room.number);
  const roomName = normalize(room.name ?? "");
  const nameNumber = roomName.replace(/^(?:аудитория|ауд\.?)\s*(?:№\s*)?/u, "");
  const repeatsNumber = roomName === number || nameNumber === number;
  const name = room.name && !repeatsNumber ? ` (${room.name})` : "";
  return `Ауд. ${room.number}${name} · ${room.building.name}`;
}

/** Weekly metadata keeps the room number and building; full names stay in details. */
export function formatScheduleRoomCompact(room: ScheduleRoom): string {
  return `Ауд. ${room.number} · ${room.building.name}`;
}

export function formatScheduleTeacherCompact(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const [first, middle, last] = parts;
  if (parts.length !== 3 || !first || !middle || !last) return fullName;
  return `${last} ${first.charAt(0)}. ${middle.charAt(0)}.`;
}
