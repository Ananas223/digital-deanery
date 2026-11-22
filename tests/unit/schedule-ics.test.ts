import { describe, expect, it } from "vitest";

import type {
  LessonChangeInput,
  LessonSnapshot,
  ScheduleDay,
  ScheduleDiscipline,
  ScheduleLesson,
  ScheduleRoom,
  ScheduleTeacher,
  ScheduleWeek,
} from "@/lib/domain/schedule";
import { resolveLessonState } from "@/lib/domain/schedule-changes";
import { buildScheduleIcs } from "@/lib/domain/schedule-ics";

const encoder = new TextEncoder();

const WEEK_DATES = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
];

const NOW = new Date("2026-11-22T10:20:30.000Z");

const building = { id: "b-1", code: "A", name: "Корпус А" };

const discipline: ScheduleDiscipline = {
  id: "d-1",
  code: "MO-101",
  name: "Дискретная математика",
};

const teacher: ScheduleTeacher = { id: "t-1", fullName: "Иванова Анна Сергеевна" };

const room: ScheduleRoom = {
  id: "r-1",
  number: "203",
  name: "Аудитория 203",
  building,
};

function makeLesson(
  overrides: {
    id?: string;
    type?: ScheduleLesson["type"];
    subgroup?: ScheduleLesson["subgroup"];
    discipline?: ScheduleDiscipline;
    teacher?: ScheduleTeacher;
    room?: ScheduleRoom;
    startsAt?: Date;
    endsAt?: Date;
    changes?: LessonChangeInput[];
  } = {},
): ScheduleLesson {
  const original: LessonSnapshot = {
    startsAt: overrides.startsAt ?? new Date("2026-11-16T08:00:00.000Z"),
    endsAt: overrides.endsAt ?? new Date("2026-11-16T09:30:00.000Z"),
    discipline: overrides.discipline ?? discipline,
    teacher: overrides.teacher ?? teacher,
    room: overrides.room ?? room,
  };
  const changes = overrides.changes ?? [];

  return {
    id: overrides.id ?? "lesson-1",
    groupCode: "MO-21-4",
    type: overrides.type ?? "LECTURE",
    subgroup: overrides.subgroup ?? "ALL",
    original,
    changes,
    effective: resolveLessonState(original, changes),
  };
}

function makeChange(
  overrides: Partial<LessonChangeInput> & Pick<LessonChangeInput, "id" | "type" | "createdAt">,
): LessonChangeInput {
  return {
    reason: null,
    newStartsAt: null,
    newEndsAt: null,
    newRoom: null,
    newTeacher: null,
    replacementDiscipline: null,
    ...overrides,
  };
}

/** Неделя с занятиями по индексу дня: 0 — понедельник, 6 — воскресенье. */
function makeWeek(lessonsByDay: ScheduleLesson[][] = []): ScheduleWeek {
  const days: ScheduleDay[] = WEEK_DATES.map((date, index) => ({
    date,
    startsAt: new Date(`${date}T00:00:00+03:00`),
    lessons: lessonsByDay[index] ?? [],
  }));

  return { weekStart: WEEK_DATES[0]!, weekNumber: 12, days };
}

/** Разворачивает перенесённые строки, чтобы проверять логические значения. */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

function octets(line: string): number {
  return encoder.encode(line).length;
}

describe("экспорт расписания в .ics", () => {
  it("строит календарь с обязательными свойствами и фиксированной зоной Москвы", () => {
    // `DTSTAMP` живёт в каждом `VEVENT`, поэтому для проверки нужна неделя с занятием.
    const ics = buildScheduleIcs(makeWeek([[makeLesson()]]), { now: NOW });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:-//Digital Deanery//Schedule//RU\r\n");
    expect(ics).toContain("CALSCALE:GREGORIAN\r\n");
    expect(ics).toContain("METHOD:PUBLISH\r\n");
    expect(ics).toContain("X-WR-TIMEZONE:Europe/Moscow\r\n");
    expect(ics).toContain("DTSTAMP:20261122T102030Z\r\n");
    expect(ics).toContain("BEGIN:VTIMEZONE\r\n");
    expect(ics).toContain("TZID:Europe/Moscow\r\n");
    expect(ics).toContain("TZOFFSETFROM:+0300\r\n");
    expect(ics).toContain("TZOFFSETTO:+0300\r\n");
    expect(ics).toContain("TZNAME:MSK\r\n");
    expect(ics).toContain("END:VTIMEZONE\r\n");
  });

  it("возвращает валидный календарь без VEVENT для пустой недели", () => {
    const ics = buildScheduleIcs(makeWeek(), { now: NOW });

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(unfold(ics)).toContain("X-WR-CALNAME:Расписание\\, неделя 2026-11-16");
  });

  it("использует только CRLF как разделитель строк", () => {
    const ics = buildScheduleIcs(makeWeek([[makeLesson()]]), { now: NOW });
    const withoutCrlf = ics.replaceAll("\r\n", "");

    expect(withoutCrlf).not.toContain("\n");
    expect(withoutCrlf).not.toContain("\r");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("экранирует обратную косую черту, точку с запятой, запятую и перевод строки", () => {
    const ics = buildScheduleIcs(
      makeWeek([
        [
          makeLesson({
            discipline: { ...discipline, name: "Дискретная; математика, часть 1 \\ итог" },
            changes: [
              makeChange({
                id: "c-1",
                type: "CANCELLATION",
                createdAt: new Date("2026-11-10T09:00:00.000Z"),
                reason: "Причина\nна двух строках",
              }),
            ],
          }),
        ],
      ]),
      { now: NOW },
    );

    const unfolded = unfold(ics);

    expect(unfolded).toContain(
      "SUMMARY:ОТМЕНЕНО: Дискретная\\; математика\\, часть 1 \\\\ итог · Лекция",
    );
    expect(unfolded).toContain(
      "DESCRIPTION:Преподаватель: Иванова Анна Сергеевна\\nПодгруппа: Вся группа\\nПричина изменения: Причина\\nна двух строках",
    );
    expect(unfolded).toContain("LOCATION:Корпус А\\, ауд. 203");
  });

  it("переносит строки длиннее 75 октетов, не разрывая UTF-8 символ", () => {
    const longName = "Очень длинная дисциплина ".repeat(8).trim();
    const ics = buildScheduleIcs(
      makeWeek([[makeLesson({ discipline: { ...discipline, name: longName } })]]),
      {
        now: NOW,
      },
    );

    const lines = ics.split("\r\n").filter((line) => line.length > 0);
    expect(lines.every((line) => octets(line) <= 75)).toBe(true);
    expect(lines.some((line) => line.startsWith(" "))).toBe(true);
    expect(ics).not.toContain("\uFFFD");
    expect(unfold(ics)).toContain(`SUMMARY:${longName} · Лекция`);
  });

  it("переводит UTC-инстант в московское время без суффикса Z", () => {
    const ics = buildScheduleIcs(
      makeWeek([
        [
          makeLesson({
            startsAt: new Date("2026-11-16T06:05:00.000Z"),
            endsAt: new Date("2026-11-16T07:35:00.000Z"),
          }),
        ],
      ]),
      { now: NOW },
    );

    expect(ics).toContain("DTSTART;TZID=Europe/Moscow:20261116T090500\r\n");
    expect(ics).toContain("DTEND;TZID=Europe/Moscow:20261116T103500\r\n");
    expect(ics).not.toMatch(/DTSTART;TZID=Europe\/Moscow:\d{8}T\d{6}Z/);
  });

  it("помечает отмену, считает изменения и сохраняет стабильный UID", () => {
    const ics = buildScheduleIcs(
      makeWeek([
        [
          makeLesson({
            id: "lesson-42",
            changes: [
              makeChange({
                id: "c-1",
                type: "TIME_CHANGE",
                createdAt: new Date("2026-11-10T09:00:00.000Z"),
                reason: "Перенос",
                newStartsAt: new Date("2026-11-16T10:00:00.000Z"),
                newEndsAt: new Date("2026-11-16T11:30:00.000Z"),
              }),
              makeChange({
                id: "c-2",
                type: "CANCELLATION",
                createdAt: new Date("2026-11-11T09:00:00.000Z"),
                reason: "Преподаватель на конференции",
              }),
            ],
          }),
        ],
      ]),
      { now: NOW },
    );

    expect(ics).toContain("UID:lesson-42@digital-deanery.local\r\n");
    expect(ics).toContain("SEQUENCE:2\r\n");
    expect(ics).toContain("STATUS:CANCELLED\r\n");
    expect(unfold(ics)).toContain("SUMMARY:ОТМЕНЕНО: Дискретная математика · Лекция");
  });

  it("для занятия без отмены ставит CONFIRMED и SEQUENCE:0", () => {
    const ics = buildScheduleIcs(makeWeek([[makeLesson()]]), { now: NOW });

    expect(ics).toContain("STATUS:CONFIRMED\r\n");
    expect(ics).toContain("SEQUENCE:0\r\n");
    expect(unfold(ics)).toContain("SUMMARY:Дискретная математика · Лекция");
    expect(unfold(ics)).toContain(
      "DESCRIPTION:Преподаватель: Иванова Анна Сергеевна\\nПодгруппа: Вся группа",
    );
  });

  it("выводит по одному VEVENT на занятие из всех семи дней", () => {
    const ics = buildScheduleIcs(
      makeWeek([
        [makeLesson({ id: "monday" })],
        [],
        [makeLesson({ id: "wednesday" })],
        [],
        [makeLesson({ id: "friday" })],
      ]),
      { now: NOW },
    );

    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("UID:monday@digital-deanery.local\r\n");
    expect(ics).toContain("UID:wednesday@digital-deanery.local\r\n");
    expect(ics).toContain("UID:friday@digital-deanery.local\r\n");
  });

  it("добавляет группу в название календаря", () => {
    const ics = buildScheduleIcs(makeWeek(), { groupCode: "MO-21-4", now: NOW });

    expect(unfold(ics)).toContain("X-WR-CALNAME:Расписание MO-21-4\\, неделя 2026-11-16");
  });
});
