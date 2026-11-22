import {
  getLessonSubgroupLabel,
  getLessonTypeLabel,
  type ScheduleLesson,
  type ScheduleWeek,
} from "@/lib/domain/schedule";
import { MOSCOW_UTC_OFFSET_MS } from "@/lib/domain/schedule-time";

/**
 * Сериализация недельного расписания в формат iCalendar (RFC 5545).
 *
 * Модуль не обращается к базе и не принимает `userId`: он получает уже
 * авторизованную `ScheduleWeek` и превращает её в `.ics`-файл. Доступ и выбор
 * недели остаются в Route Handler (`docs/specs/p2-schedule-ui.md` § 4.4).
 *
 * Москва с 2014 года живёт в UTC+3 без перехода на летнее время, поэтому
 * локальное время считается фиксированным смещением, а не системной зоной.
 */

const MOSCOW_TZID = "Europe/Moscow";
const CALENDAR_NAME = "Расписание";
const PRODID = "-//Digital Deanery//Schedule//RU";
const UID_DOMAIN = "digital-deanery.local";

/** Максимальная длина строки ICS в октетах по RFC 5545. */
const MAX_LINE_OCTETS = 75;

/** Продолжение строки начинается с пробела, который тоже входит в лимит. */
const CONTINUATION_OCTETS = MAX_LINE_OCTETS - 1;

const encoder = new TextEncoder();

export type BuildScheduleIcsOptions = {
  /** Код группы для `X-WR-CALNAME`; без него название остаётся нейтральным. */
  groupCode?: string;
  /** Момент генерации для `DTSTAMP`; в тестах подменяется. */
  now?: Date;
};

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

/** `ГГГГММДДТЧЧММСС` в UTC-компонентах, без `Z`. */
function formatUtcDateTime(date: Date): string {
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

/** Локальное московское время в формате ICS: инстант сдвигается на +03:00. */
function formatMoscowDateTime(date: Date): string {
  return formatUtcDateTime(new Date(date.getTime() + MOSCOW_UTC_OFFSET_MS));
}

/**
 * Экранирует TEXT-значение по RFC 5545: обратная косая черта, точка с запятой,
 * запятая и перевод строки. Порядок важен: сначала экранируется `\`, иначе
 * добавленные обратные косые черты будут экранированы повторно.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Переносит длинную строку по RFC 5545: не длиннее 75 октетов, продолжение —
 * `CRLF` и один пробел. Итерация по кодовым точкам не разрывает UTF-8 символ,
 * даже если он занимает два и более октета.
 */
function foldLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) {
    return line;
  }

  const parts: string[] = [];
  let current = "";
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;

  for (const character of line) {
    const octets = encoder.encode(character).length;

    if (currentOctets + octets > limit) {
      parts.push(current);
      current = "";
      currentOctets = 0;
      limit = CONTINUATION_OCTETS;
    }

    current += character;
    currentOctets += octets;
  }

  parts.push(current);

  return parts.join("\r\n ");
}

function buildEventLines(lesson: ScheduleLesson, dtstamp: string): string[] {
  const cancelled = lesson.effective.status === "CANCELLED";
  const summary = `${lesson.effective.discipline.name} · ${getLessonTypeLabel(lesson.type)}`;
  const description = [
    `Преподаватель: ${lesson.effective.teacher.fullName}`,
    `Подгруппа: ${getLessonSubgroupLabel(lesson.subgroup)}`,
    ...lesson.changes.flatMap((change) => {
      const reason = change.reason?.trim();
      return reason ? [`Причина изменения: ${reason}`] : [];
    }),
  ].join("\n");
  const location = `${lesson.effective.room.building.name}, ауд. ${lesson.effective.room.number}`;

  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(`${lesson.id}@${UID_DOMAIN}`)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${MOSCOW_TZID}:${formatMoscowDateTime(lesson.effective.startsAt)}`,
    `DTEND;TZID=${MOSCOW_TZID}:${formatMoscowDateTime(lesson.effective.endsAt)}`,
    `SUMMARY:${escapeIcsText(cancelled ? `ОТМЕНЕНО: ${summary}` : summary)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `SEQUENCE:${lesson.changes.length}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
  ];
}

/**
 * Строит валидный `.ics`-календарь на неделю: один `VEVENT` на занятие,
 * московское время, учтённые переносы, замены и отмены.
 *
 * Пустая неделя даёт календарь без `VEVENT`, а не ошибку. Строки разделяются
 * `CRLF`, значения экранируются, длинные строки переносятся по RFC 5545.
 */
export function buildScheduleIcs(
  week: ScheduleWeek,
  options: BuildScheduleIcsOptions = {},
): string {
  const now = options.now ?? new Date();
  const dtstamp = `${formatUtcDateTime(now)}Z`;
  const calendarName = options.groupCode
    ? `${CALENDAR_NAME} ${options.groupCode}, неделя ${week.weekStart}`
    : `${CALENDAR_NAME}, неделя ${week.weekStart}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${MOSCOW_TZID}`,
    "BEGIN:VTIMEZONE",
    `TZID:${MOSCOW_TZID}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0300",
    "TZNAME:MSK",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const day of week.days) {
    for (const lesson of day.lessons) {
      lines.push(...buildEventLines(lesson, dtstamp));
    }
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
