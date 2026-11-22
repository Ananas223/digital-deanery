import { describe, expect, it } from "vitest";

import {
  buildHonorsForecast,
  buildWhatIfPlan,
  getWhatIfCandidates,
  toForecastGrade,
  type ForecastGrade,
} from "@/lib/domain/grades-forecast";

const SEMESTER_ENDS_AT = new Date("2026-12-25T23:59:59.000Z");
const DURING_SEMESTER = new Date("2026-11-16T12:00:00.000Z");
const AFTER_SEMESTER = new Date("2027-01-15T12:00:00.000Z");

let sequence = 0;

function grade(overrides: Partial<ForecastGrade> = {}): ForecastGrade {
  sequence += 1;
  return {
    id: `grade-${sequence}`,
    disciplineId: `discipline-${sequence}`,
    disciplineName: `Дисциплина ${sequence}`,
    assessmentType: "EXAM",
    status: "PASSED",
    score: 5,
    ...overrides,
  };
}

function ungraded(overrides: Partial<ForecastGrade> = {}): ForecastGrade {
  return grade({ assessmentType: "COURSEWORK", status: "NOT_GRADED", score: null, ...overrides });
}

function numericScores(scores: number[]): ForecastGrade[] {
  return scores.map((score) => grade({ score }));
}

describe("прогноз без данных", () => {
  it("возвращает NO_DATA и null-долю для пустого списка", () => {
    const forecast = buildHonorsForecast([]);

    expect(forecast).toMatchObject({
      state: "NO_DATA",
      share: null,
      threshold: 0.75,
      neededExcellent: 0,
      numericCount: 0,
      excellentCount: 0,
    });
    expect(forecast.message).toContain("Числовых оценок пока нет");
  });

  it("не считает зачёты и дисциплины без оценки числовыми", () => {
    const forecast = buildHonorsForecast([
      grade({ assessmentType: "CREDIT", status: "PASSED", score: null }),
      grade({ assessmentType: "EXAM", status: "NOT_GRADED", score: null }),
    ]);

    expect(forecast.state).toBe("NO_DATA");
    expect(forecast.numericCount).toBe(0);
  });
});

describe("доля «отлично» и порог 75 %", () => {
  it("считает 3 из 4 пятёрок достаточными", () => {
    const forecast = buildHonorsForecast(numericScores([5, 5, 5, 4]));

    expect(forecast.share).toBe(0.75);
    expect(forecast.state).toBe("ON_TRACK");
    expect(forecast.neededExcellent).toBe(0);
    expect(forecast.message).toContain("75 %");
  });

  it("считает 2 из 3 пятёрок недостаточными и просит ещё одну", () => {
    const forecast = buildHonorsForecast([...numericScores([5, 5, 4]), ungraded()]);

    expect(forecast.share).toBeCloseTo(2 / 3);
    expect(forecast.state).toBe("BELOW_THRESHOLD");
    expect(forecast.numericCount).toBe(3);
    expect(forecast.excellentCount).toBe(2);
    expect(forecast.neededExcellent).toBe(1);
    expect(forecast.message).toContain("Нужно ещё 1 оценка «отлично»");
  });
});

describe("формула m = 3n − 4e", () => {
  it("учитывает рост знаменателя, когда есть дисциплины без оценки", () => {
    const grades = [...numericScores([5, 5, 4, 4]), ungraded(), ungraded(), ungraded(), ungraded()];

    const forecast = buildHonorsForecast(grades);

    expect(forecast.numericCount).toBe(4);
    expect(forecast.excellentCount).toBe(2);
    expect(forecast.neededExcellent).toBe(4);
    expect(forecast.state).toBe("BELOW_THRESHOLD");
  });

  it("возвращает неотрицательное число нужных пятёрок", () => {
    expect(buildHonorsForecast(numericScores([5, 5, 5])).neededExcellent).toBe(0);
    expect(buildHonorsForecast(numericScores([5, 5, 5, 4, 4])).neededExcellent).toBe(3);
  });
});

describe("недостижимость красного диплома", () => {
  it("делает прогноз невозможным при оценке 3 или ниже", () => {
    const forecast = buildHonorsForecast(numericScores([3, 5, 5]));

    expect(forecast.state).toBe("IMPOSSIBLE");
    expect(forecast.message).toContain("оценка 3 или ниже");
  });

  it("делает прогноз невозможным при незачёте", () => {
    const forecast = buildHonorsForecast([
      grade({ assessmentType: "CREDIT", status: "FAILED", score: null }),
      grade({ score: 5 }),
    ]);

    expect(forecast.state).toBe("IMPOSSIBLE");
    expect(forecast.message).toContain("незачёт");
  });

  it("учитывает просроченную NOT_GRADED только при переданных датах", () => {
    const grades = [grade({ score: 5 }), ungraded()];

    const afterSemester = buildHonorsForecast(grades, {
      semesterEndsAt: SEMESTER_ENDS_AT,
      now: AFTER_SEMESTER,
    });
    const duringSemester = buildHonorsForecast(grades, {
      semesterEndsAt: SEMESTER_ENDS_AT,
      now: DURING_SEMESTER,
    });
    const withoutDates = buildHonorsForecast(grades);

    expect(afterSemester.state).toBe("IMPOSSIBLE");
    expect(afterSemester.message).toContain("после окончания семестра");
    expect(duringSemester.state).not.toBe("IMPOSSIBLE");
    expect(withoutDates.state).not.toBe("IMPOSSIBLE");
  });

  it("оставляет шанс, пока дисциплины без оценки могут стать пятёрками", () => {
    const forecast = buildHonorsForecast([...numericScores([5, 4]), ungraded(), ungraded()]);

    expect(forecast.state).toBe("BELOW_THRESHOLD");
    expect(forecast.neededExcellent).toBe(2);
  });

  it("признаёт недостижимость, даже если все дисциплины без оценки станут пятёрками", () => {
    const forecast = buildHonorsForecast([...numericScores([5, 5, 4, 4]), ungraded()]);

    expect(forecast.state).toBe("IMPOSSIBLE");
    expect(forecast.message).toContain("даже если все дисциплины без оценки станут");
  });
});

describe("«а если?»", () => {
  const annaGrades = [
    grade({ score: 5 }),
    grade({ score: 4 }),
    grade({ assessmentType: "CREDIT", status: "PASSED", score: null }),
    grade({ score: 5 }),
    ungraded(),
  ];

  it("считает нужный балл для цели 4,5", () => {
    const plan = buildWhatIfPlan(annaGrades, { target: 4.5 });

    expect(plan.numericCount).toBe(3);
    expect(plan.sum).toBe(14);
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]).toMatchObject({
      requiredScore: 4,
      reachable: true,
    });
    expect(plan.candidates[0]!.message).toContain("4");
  });

  it("показывает недостижимость для цели 5", () => {
    const plan = buildWhatIfPlan(annaGrades, { target: 5 });

    expect(plan.candidates[0]).toMatchObject({
      requiredScore: null,
      reachable: false,
    });
    expect(plan.candidates[0]!.message).toContain("недостижима");
  });

  it("не опускает нужный балл ниже 3", () => {
    const plan = buildWhatIfPlan([...numericScores([5, 5, 5, 5]), ungraded()], { target: 4.5 });

    expect(plan.candidates[0]).toMatchObject({
      requiredScore: 3,
      reachable: true,
    });
  });

  it("не предлагает зачёты, незачёты и уже оценённые дисциплины", () => {
    const grades = [
      grade({ assessmentType: "CREDIT", status: "PASSED", score: null }),
      grade({ assessmentType: "CREDIT", status: "FAILED", score: null }),
      grade({ assessmentType: "EXAM", status: "FAILED", score: null }),
      grade({ score: 4 }),
      ungraded(),
    ];

    const candidates = getWhatIfCandidates(grades);
    const plan = buildWhatIfPlan(grades, { target: 4.5 });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.status).toBe("NOT_GRADED");
    expect(plan.candidates).toHaveLength(1);
  });

  it("возвращает пустой список, когда целить нечего", () => {
    const plan = buildWhatIfPlan(
      [grade({ score: 5 }), grade({ assessmentType: "CREDIT", status: "PASSED", score: null })],
      { target: 4.5 },
    );

    expect(plan.candidates).toEqual([]);
  });

  it("не меняет переданные оценки", () => {
    const grades = annaGrades.map((item) => ({ ...item }));
    const snapshot = structuredClone(grades);

    buildHonorsForecast(grades, { semesterEndsAt: SEMESTER_ENDS_AT, now: DURING_SEMESTER });
    buildWhatIfPlan(grades, { target: 5 });

    expect(grades).toEqual(snapshot);
  });
});

describe("преобразование оценки", () => {
  it("собирает ForecastGrade из серверной записи", () => {
    const entry = {
      id: "grade-1",
      discipline: { id: "discipline-1", name: "История международных отношений", code: "MO-101" },
      teacherName: "Ирина Соколова",
      assessmentType: "EXAM" as const,
      credits: 4,
      score: 5,
      status: "PASSED" as const,
    };

    expect(toForecastGrade(entry)).toEqual({
      id: "grade-1",
      disciplineId: "discipline-1",
      disciplineName: "История международных отношений",
      assessmentType: "EXAM",
      status: "PASSED",
      score: 5,
    });
  });
});
