import { describe, expect, it } from "vitest";

import {
  addMoscowDays,
  getAcademicYearStart,
  getMoscowDateKey,
  getMoscowWeekday,
  getStudyWeekNumber,
  startOfMoscowDay,
  startOfMoscowWeek,
} from "@/lib/domain/schedule-time";

describe("московские границы дня", () => {
  it("относит 23:59 по Москве к текущему дню", () => {
    const lateEvening = new Date("2026-03-02T20:59:59.000Z");

    expect(getMoscowDateKey(lateEvening)).toBe("2026-03-02");
    expect(startOfMoscowDay(lateEvening).toISOString()).toBe("2026-03-01T21:00:00.000Z");
  });

  it("начинает новые сутки в 00:00 по Москве", () => {
    const midnight = new Date("2026-03-02T21:00:00.000Z");

    expect(getMoscowDateKey(midnight)).toBe("2026-03-03");
    expect(startOfMoscowDay(midnight).toISOString()).toBe("2026-03-02T21:00:00.000Z");
  });

  it("сдвигает дату на московские сутки", () => {
    const dayStart = new Date("2026-03-01T21:00:00.000Z");

    expect(addMoscowDays(dayStart, 1).toISOString()).toBe("2026-03-02T21:00:00.000Z");
    expect(addMoscowDays(dayStart, -1).toISOString()).toBe("2026-02-28T21:00:00.000Z");
  });
});

describe("московская неделя", () => {
  it("определяет день недели: понедельник — 1, воскресенье — 0", () => {
    expect(getMoscowWeekday(new Date("2026-03-02T00:30:00+03:00"))).toBe(1);
    expect(getMoscowWeekday(new Date("2026-03-08T23:30:00+03:00"))).toBe(0);
  });

  it("начинает неделю с понедельника 00:00 по Москве", () => {
    const sunday = new Date("2026-03-08T12:00:00.000Z");

    expect(startOfMoscowWeek(sunday).toISOString()).toBe("2026-03-01T21:00:00.000Z");
    expect(getMoscowDateKey(startOfMoscowWeek(sunday))).toBe("2026-03-02");
  });

  it("оставляет понедельник началом своей недели", () => {
    const monday = new Date("2026-03-02T09:00:00+03:00");

    expect(startOfMoscowWeek(monday).toISOString()).toBe("2026-03-01T21:00:00.000Z");
  });
});

describe("учебные недели", () => {
  it("начинает учебный год с недели, содержащей 1 сентября", () => {
    const november = new Date("2026-11-14T12:00:00.000Z");

    expect(getAcademicYearStart(november).toISOString()).toBe("2026-08-30T21:00:00.000Z");
  });

  it("считает первую неделю от 1 сентября", () => {
    const septemberFirst = new Date("2026-09-01T00:00:00+03:00");
    const nextMonday = new Date("2026-09-07T00:00:00+03:00");

    expect(getStudyWeekNumber(septemberFirst)).toBe(1);
    expect(getStudyWeekNumber(nextMonday)).toBe(2);
  });

  it("нумерует недели ноября", () => {
    expect(getStudyWeekNumber(new Date("2026-11-14T12:00:00.000Z"))).toBe(11);
  });

  it("учитывает переданное начало семестра", () => {
    const semesterStart = new Date("2026-02-09T00:00:00+03:00");

    expect(getStudyWeekNumber(new Date("2026-03-01T12:00:00.000Z"), semesterStart)).toBe(3);
    expect(getStudyWeekNumber(new Date("2026-02-01T12:00:00.000Z"), semesterStart)).toBe(1);
  });
});
