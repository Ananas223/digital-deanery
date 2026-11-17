import { describe, expect, it } from "vitest";

import { addMoscowWorkingDays, getMoscowYear } from "@/lib/domain/request-time";

describe("addMoscowWorkingDays", () => {
  it("переносит срок с пятницы на понедельник", () => {
    const friday = new Date("2026-11-13T10:00:00.000Z");

    expect(addMoscowWorkingDays(friday, 1).toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });

  it("пропускает выходные при нескольких рабочих днях", () => {
    const friday = new Date("2026-11-13T10:00:00.000Z");

    expect(addMoscowWorkingDays(friday, 5).toISOString()).toBe("2026-11-20T10:00:00.000Z");
  });

  it("считает рабочие дни по московскому календарю", () => {
    // Воскресенье 22:30 UTC — уже понедельник по Москве.
    const sundayNight = new Date("2026-11-15T22:30:00.000Z");

    expect(addMoscowWorkingDays(sundayNight, 1).toISOString()).toBe("2026-11-16T22:30:00.000Z");
  });

  it("возвращает тот же момент при нулевом сроке", () => {
    const date = new Date("2026-11-13T10:00:00.000Z");

    expect(addMoscowWorkingDays(date, 0).toISOString()).toBe(date.toISOString());
  });

  it("отклоняет отрицательный срок", () => {
    expect(() => addMoscowWorkingDays(new Date(), -1)).toThrow(RangeError);
  });
});

describe("getMoscowYear", () => {
  it("берёт год по Москве, а не по UTC", () => {
    expect(getMoscowYear(new Date("2026-12-31T22:00:00.000Z"))).toBe(2027);
  });

  it("обычная дата остаётся в своём году", () => {
    expect(getMoscowYear(new Date("2026-06-15T12:00:00.000Z"))).toBe(2026);
  });
});
