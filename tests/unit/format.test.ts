import { describe, expect, it } from "vitest";

import {
  formatCourse,
  formatDate,
  formatDateTime,
  formatNumber,
  getFirstName,
  getInitials,
} from "@/lib/format";

const NBSP = "\u00A0";

describe("formatDate", () => {
  it("форматирует дату по-русски в часовом поясе Москвы", () => {
    expect(formatDate(new Date("2026-03-05T09:07:00.000Z"))).toBe("05.03.2026");
  });

  it("учитывает переход через полночь по Москве", () => {
    expect(formatDate("2026-03-05T21:30:00.000Z")).toBe("06.03.2026");
  });

  it("возвращает прочерк для некорректной даты", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("показывает дату и время в 24-часовом формате", () => {
    expect(formatDateTime(new Date("2026-03-05T09:07:00.000Z"))).toBe("05.03.2026, 12:07");
  });

  it("возвращает прочерк для некорректной даты", () => {
    expect(formatDateTime(Number.NaN)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("использует русские разделители разрядов и десятичную запятую", () => {
    expect(formatNumber(1234567.891, { maximumFractionDigits: 2 })).toBe(
      `1${NBSP}234${NBSP}567,89`,
    );
  });

  it("форматирует целые и отрицательные числа", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(-1234.5)).toBe(`-1${NBSP}234,5`);
  });

  it("возвращает прочерк для нечислового значения", () => {
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatCourse", () => {
  it("склоняет слово «курс» по числу", () => {
    expect(formatCourse(1)).toBe("1 курс");
    expect(formatCourse(2)).toBe("2 курса");
    expect(formatCourse(4)).toBe("4 курса");
    expect(formatCourse(5)).toBe("5 курсов");
    expect(formatCourse(11)).toBe("11 курсов");
    expect(formatCourse(21)).toBe("21 курс");
  });

  it("возвращает прочерк для некорректного значения", () => {
    expect(formatCourse(0)).toBe("—");
    expect(formatCourse(1.5)).toBe("—");
  });
});

describe("вспомогательные функции имени", () => {
  it("берёт первое слово для приветствия", () => {
    expect(getFirstName("  Анна Петрова  ")).toBe("Анна");
  });

  it("строит инициалы из первого и последнего слова", () => {
    expect(getInitials("Анна Петрова")).toBe("АП");
    expect(getInitials("Пётр")).toBe("П");
    expect(getInitials("   ")).toBe("?");
  });
});
