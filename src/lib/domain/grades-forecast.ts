/**
 * Прогноз красного диплома и «а если?» (`Ф-03.9`, `Ф-03.10`).
 *
 * Модуль намеренно не помечен `server-only`: это чистые функции без доступа к
 * данным. Их вызывает серверная страница и клиентский блок «а если?», поэтому
 * из Prisma импортируются только типы перечислений, а клиент БД не подключается.
 */

import type { AssessmentType, GradeStatus } from "@/generated/prisma/enums";

/** Оценка в том виде, в котором она нужна прогнозу. */
export type ForecastGrade = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  assessmentType: AssessmentType;
  status: GradeStatus;
  score: number | null;
};

/** Минимальный набор полей `GradeEntry`, из которого собирается `ForecastGrade`. */
export type ForecastGradeSource = {
  id: string;
  discipline: { id: string; name: string };
  assessmentType: AssessmentType;
  status: GradeStatus;
  score: number | null;
};

/** Единое преобразование серверной оценки в сериализуемую для клиента. */
export function toForecastGrade(grade: ForecastGradeSource): ForecastGrade {
  return {
    id: grade.id,
    disciplineId: grade.discipline.id,
    disciplineName: grade.discipline.name,
    assessmentType: grade.assessmentType,
    status: grade.status,
    score: grade.score,
  };
}

/** Порог красного диплома: не менее 75 % оценок «отлично». */
export const HONORS_THRESHOLD = 0.75;

const EXCELLENT_SCORE = 5;
const MIN_NUMERIC_SCORE = 2;
const MAX_NUMERIC_SCORE = 5;
const MIN_REQUIRED_SCORE = 3;
const MAX_REQUIRED_SCORE = 5;

export type HonorsForecastState = "NO_DATA" | "ON_TRACK" | "BELOW_THRESHOLD" | "IMPOSSIBLE";

export type HonorsForecast = {
  state: HonorsForecastState;
  /** Доля «отлично» среди числовых оценок; `null`, когда числовых оценок нет. */
  share: number | null;
  threshold: number;
  /** Сколько ещё оценок «отлично» нужно по формуле `m = max(0, 3n − 4e)`. */
  neededExcellent: number;
  numericCount: number;
  excellentCount: number;
  message: string;
};

export type HonorsForecastOptions = {
  semesterEndsAt?: Date;
  now?: Date;
};

export type WhatIfTarget = 4.5 | 5;

export type WhatIfCandidate = {
  disciplineId: string;
  disciplineName: string;
  /** Нужный балл 3–5; `null`, если даже 5 не хватает. */
  requiredScore: number | null;
  reachable: boolean;
  message: string;
};

export type WhatIfPlan = {
  numericCount: number;
  sum: number;
  candidates: WhatIfCandidate[];
};

const NO_DATA_MESSAGE =
  "Числовых оценок пока нет: прогноз появится после первых экзаменов и дифференцированных зачётов. Зачёты и дисциплины без оценки в расчёт не входят.";

/** Один экземпляр на модуль: создание `Intl.PluralRules` дороже выбора формы. */
const PLURAL_RULES = new Intl.PluralRules("ru-RU");

const GRADE_WORDS: Record<Intl.LDMLPluralRule, string> = {
  zero: "оценок",
  one: "оценка",
  two: "оценки",
  few: "оценки",
  many: "оценок",
  other: "оценок",
};

function gradeWord(count: number): string {
  return GRADE_WORDS[PLURAL_RULES.select(count)];
}

function formatPercent(share: number): string {
  return `${Math.round(share * 100)} %`;
}

function formatTarget(target: WhatIfTarget): string {
  return target === 5 ? "5" : "4,5";
}

function isNumericScore(score: number | null): score is number {
  return score !== null && score >= MIN_NUMERIC_SCORE && score <= MAX_NUMERIC_SCORE;
}

function buildImpossibleMessage(reasons: readonly string[]): string {
  return `Красный диплом недостижим: ${reasons.join("; ")}.`;
}

/**
 * Прогноз красного диплома по числовым оценкам семестра.
 *
 * В знаменатель входят только оценки 2–5. Зачёты (`CREDIT`) и оценки без числа
 * не учитываются. Нужное число пятёрок считается с учётом роста знаменателя:
 * `m = max(0, 3n − 4e)`. Красный диплом недостижим при оценке 3 или ниже, при
 * `FAILED`, при просроченной `NOT_GRADED` (когда переданы даты семестра и `now`)
 * и когда даже все дисциплины без оценки не поднимут долю до порога.
 */
export function buildHonorsForecast(
  grades: readonly ForecastGrade[],
  options: HonorsForecastOptions = {},
): HonorsForecast {
  let numericCount = 0;
  let excellentCount = 0;
  let notGradedCount = 0;
  let hasLowScore = false;
  let hasFailed = false;

  for (const grade of grades) {
    if (grade.status === "FAILED") {
      hasFailed = true;
    }
    if (grade.status === "NOT_GRADED" && grade.assessmentType !== "CREDIT") {
      notGradedCount += 1;
    }
    if (!isNumericScore(grade.score)) {
      continue;
    }
    numericCount += 1;
    if (grade.score === EXCELLENT_SCORE) {
      excellentCount += 1;
    }
    if (grade.score <= 3) {
      hasLowScore = true;
    }
  }

  const { semesterEndsAt, now } = options;
  const hasOverdueNotGraded =
    semesterEndsAt !== undefined &&
    now !== undefined &&
    now.getTime() > semesterEndsAt.getTime() &&
    grades.some((grade) => grade.status === "NOT_GRADED");

  const share = numericCount === 0 ? null : excellentCount / numericCount;
  const neededExcellent = Math.max(0, 3 * numericCount - 4 * excellentCount);
  const allUngradedExcellentStillShort =
    numericCount + notGradedCount > 0 &&
    excellentCount + notGradedCount < Math.ceil(HONORS_THRESHOLD * (numericCount + notGradedCount));

  const base = {
    share,
    threshold: HONORS_THRESHOLD,
    neededExcellent,
    numericCount,
    excellentCount,
  };

  if (hasLowScore || hasFailed || hasOverdueNotGraded || allUngradedExcellentStillShort) {
    const reasons: string[] = [];
    if (hasLowScore) {
      reasons.push("есть оценка 3 или ниже");
    }
    if (hasFailed) {
      reasons.push("есть незачёт");
    }
    if (hasOverdueNotGraded) {
      reasons.push("есть дисциплина без оценки после окончания семестра");
    }
    if (allUngradedExcellentStillShort) {
      reasons.push("даже если все дисциплины без оценки станут «отлично», доля не достигнет 75 %");
    }
    return { ...base, state: "IMPOSSIBLE", message: buildImpossibleMessage(reasons) };
  }

  if (numericCount === 0 || share === null) {
    return { ...base, state: "NO_DATA", message: NO_DATA_MESSAGE };
  }

  if (share >= HONORS_THRESHOLD) {
    return {
      ...base,
      state: "ON_TRACK",
      message: `Доля «отлично» — ${formatPercent(share)} % при пороге 75 %. Этого достаточно для красного диплома.`,
    };
  }

  return {
    ...base,
    state: "BELOW_THRESHOLD",
    message: `Доля «отлично» — ${formatPercent(share)} % при пороге 75 %. Нужно ещё ${neededExcellent} ${gradeWord(neededExcellent)} «отлично»: расчёт m = 3n − 4e учитывает, что знаменатель тоже растёт.`,
  };
}

/**
 * Дисциплины, по которым имеет смысл считать «а если?»: нет числовой оценки,
 * это не зачёт и нет незачёта. Зачёт и провал целью не становятся.
 */
export function getWhatIfCandidates(grades: readonly ForecastGrade[]): ForecastGrade[] {
  return grades.filter(
    (grade) =>
      grade.score === null && grade.assessmentType !== "CREDIT" && grade.status !== "FAILED",
  );
}

/**
 * План «а если?»: какой балл нужен по дисциплине без оценки, чтобы выйти на
 * целевое среднее. `required = max(3, ceil(target × (n + 1) − sum))`; если даже
 * 5 не хватает, цель недостижима и `requiredScore` равен `null`.
 */
export function buildWhatIfPlan(
  grades: readonly ForecastGrade[],
  options: { target: WhatIfTarget },
): WhatIfPlan {
  let numericCount = 0;
  let sum = 0;

  for (const grade of grades) {
    if (isNumericScore(grade.score)) {
      numericCount += 1;
      sum += grade.score;
    }
  }

  const targetLabel = formatTarget(options.target);
  const candidates = getWhatIfCandidates(grades).map((grade): WhatIfCandidate => {
    const required = Math.max(
      MIN_REQUIRED_SCORE,
      Math.ceil(options.target * (numericCount + 1) - sum),
    );
    const reachable = required <= MAX_REQUIRED_SCORE;

    return {
      disciplineId: grade.disciplineId,
      disciplineName: grade.disciplineName,
      requiredScore: reachable ? required : null,
      reachable,
      message: reachable
        ? `Для среднего ${targetLabel} нужен балл ${required}.`
        : `Цель ${targetLabel} недостижима: даже оценка 5 не поднимет средний балл до ${targetLabel}.`,
    };
  });

  return { numericCount, sum, candidates };
}
