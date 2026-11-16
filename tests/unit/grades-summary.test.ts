import { describe, expect, it } from "vitest";

import { buildGradesSummary, type GradesSummaryInput } from "@/lib/domain/grades-summary";

const SEMESTER = { endsAt: new Date("2026-12-25T23:59:59.000Z") };
const DURING_SEMESTER = new Date("2026-11-16T12:00:00.000Z");
const AFTER_SEMESTER = new Date("2027-01-15T12:00:00.000Z");
const AT_SEMESTER_END = new Date(SEMESTER.endsAt);

function grade(overrides: Partial<GradesSummaryInput> = {}): GradesSummaryInput {
  return { status: "PASSED", score: 5, credits: 3, ...overrides };
}

function failedGrades(count: number): GradesSummaryInput[] {
  return Array.from({ length: count }, () => grade({ status: "FAILED", score: 2 }));
}

describe("сводка без данных", () => {
  it("возвращает нули и NO_DATA для пустого списка", () => {
    const summary = buildGradesSummary([], SEMESTER, DURING_SEMESTER);

    expect(summary).toEqual({
      averageScore: null,
      totalCredits: 0,
      earnedCredits: 0,
      plannedCredits: 0,
      failedCredits: 0,
      debtCount: 0,
      state: "NO_DATA",
      message: "За семестр пока нет данных.",
    });
  });

  it("не выдаёт пустой список за состояние OK", () => {
    expect(buildGradesSummary([], SEMESTER, AFTER_SEMESTER).state).not.toBe("OK");
  });
});

describe("средний балл", () => {
  it("округляет среднее арифметическое до двух знаков", () => {
    const grades = [grade({ score: 5 }), grade({ score: 4 }), grade({ score: 4 })];

    expect(buildGradesSummary(grades, SEMESTER, DURING_SEMESTER).averageScore).toBe(4.33);
  });

  it("пропускает null и делит только на число оценок", () => {
    const grades = [
      grade({ score: 5 }),
      grade({ status: "NOT_GRADED", score: null }),
      grade({ score: 4 }),
    ];

    expect(buildGradesSummary(grades, SEMESTER, DURING_SEMESTER).averageScore).toBe(4.5);
  });

  it("учитывает оценку 2 как обычную", () => {
    const grades = [grade({ status: "FAILED", score: 2 })];

    expect(buildGradesSummary(grades, SEMESTER, DURING_SEMESTER).averageScore).toBe(2);
  });

  it("возвращает null, если числовых оценок нет", () => {
    const grades = [
      grade({ status: "NOT_GRADED", score: null }),
      grade({ status: "NOT_GRADED", score: null }),
    ];

    expect(buildGradesSummary(grades, SEMESTER, DURING_SEMESTER).averageScore).toBeNull();
  });
});

describe("зачётные единицы", () => {
  it("делит кредиты по статусам и считает общую сумму", () => {
    const grades = [
      grade({ status: "PASSED", credits: 4 }),
      grade({ status: "NOT_GRADED", score: null, credits: 3 }),
      grade({ status: "FAILED", score: 2, credits: 2 }),
    ];

    const summary = buildGradesSummary(grades, SEMESTER, DURING_SEMESTER);

    expect(summary).toMatchObject({
      totalCredits: 9,
      earnedCredits: 4,
      plannedCredits: 3,
      failedCredits: 2,
    });
  });
});

describe("задолженности", () => {
  it("во время семестра считает задолженностью только FAILED", () => {
    const grades = [
      grade({ status: "FAILED", score: 2 }),
      grade({ status: "NOT_GRADED", score: null }),
    ];

    const summary = buildGradesSummary(grades, SEMESTER, DURING_SEMESTER);

    expect(summary.debtCount).toBe(1);
    expect(summary.state).toBe("DEBTS");
  });

  it("после endsAt считает задолженностью и NOT_GRADED", () => {
    const grades = [
      grade({ status: "FAILED", score: 2 }),
      grade({ status: "NOT_GRADED", score: null }),
    ];

    const summary = buildGradesSummary(grades, SEMESTER, AFTER_SEMESTER);

    expect(summary.debtCount).toBe(2);
    expect(summary.state).toBe("DEBTS");
  });

  it("склоняет слово «задолженность» по числу", () => {
    const messageFor = (count: number): string =>
      buildGradesSummary(failedGrades(count), SEMESTER, DURING_SEMESTER).message;

    expect(messageFor(1)).toBe("Есть задолженности: 1 задолженность.");
    expect(messageFor(2)).toBe("Есть задолженности: 2 задолженности.");
    expect(messageFor(5)).toBe("Есть задолженности: 5 задолженностей.");
    expect(messageFor(11)).toBe("Есть задолженности: 11 задолженностей.");
    expect(messageFor(21)).toBe("Есть задолженности: 21 задолженность.");
  });

  it("не считает NOT_GRADED задолженностью ровно в момент окончания семестра", () => {
    const grades = [grade({ status: "NOT_GRADED", score: null })];

    const summary = buildGradesSummary(grades, SEMESTER, AT_SEMESTER_END);

    expect(summary.debtCount).toBe(0);
    expect(summary.state).toBe("OK");
  });
});

describe("состояние OK", () => {
  it("сообщает об отсутствии задолженностей при всех PASSED", () => {
    const grades = [grade(), grade({ score: 4 }), grade({ score: 5 })];

    const summary = buildGradesSummary(grades, SEMESTER, AFTER_SEMESTER);

    expect(summary.state).toBe("OK");
    expect(summary.debtCount).toBe(0);
    expect(summary.message).toBe("Учёба в норме, задолженностей нет.");
  });
});
