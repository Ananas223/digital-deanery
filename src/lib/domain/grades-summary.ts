/**
 * Сводка успеваемости за семестр: средний балл, зачётные единицы, задолженности
 * и короткий текстовый вывод (`Ф-03.5`).
 *
 * Модуль намеренно не помечен `server-only`: это чистая функция без доступа к
 * данным, её вызывают серверные страницы и проверяют юнит-тесты. Из Prisma
 * импортируется только тип статуса оценки, клиент БД не подключается.
 */

import type { GradeStatus } from "@/generated/prisma/enums";

export type GradesSummaryInput = {
  status: GradeStatus;
  score: number | null;
  credits: number;
};

export type GradesSummaryState = "OK" | "DEBTS" | "NO_DATA";

export type GradesSummary = {
  averageScore: number | null;
  totalCredits: number;
  earnedCredits: number;
  plannedCredits: number;
  failedCredits: number;
  debtCount: number;
  state: GradesSummaryState;
  message: string;
};

const NO_DATA_MESSAGE = "За семестр пока нет данных.";
const OK_MESSAGE = "Учёба в норме, задолженностей нет.";

/** Один экземпляр на модуль: создание `Intl.PluralRules` заметно дороже выбора формы. */
const DEBT_PLURAL_RULES = new Intl.PluralRules("ru-RU");

const DEBT_WORDS: Record<Intl.LDMLPluralRule, string> = {
  zero: "задолженностей",
  one: "задолженность",
  two: "задолженности",
  few: "задолженности",
  many: "задолженностей",
  other: "задолженностей",
};

function formatDebtMessage(debtCount: number): string {
  const word = DEBT_WORDS[DEBT_PLURAL_RULES.select(debtCount)];

  return `Есть задолженности: ${debtCount} ${word}.`;
}

/** Пустая сводка: данных за семестр ещё нет. */
function buildEmptySummary(): GradesSummary {
  return {
    averageScore: null,
    totalCredits: 0,
    earnedCredits: 0,
    plannedCredits: 0,
    failedCredits: 0,
    debtCount: 0,
    state: "NO_DATA",
    message: NO_DATA_MESSAGE,
  };
}

/**
 * Считает сводку по оценкам семестра.
 *
 * `NOT_GRADED` считается задолженностью только после `semester.endsAt`: во время
 * семестра оценка просто ещё не выставлена. Числовые оценки участвуют в среднем
 * балле, `null` пропускается; оценка 2 участвует как обычная.
 */
export function buildGradesSummary(
  grades: readonly GradesSummaryInput[],
  semester: { endsAt: Date },
  now: Date,
): GradesSummary {
  if (grades.length === 0) {
    return buildEmptySummary();
  }

  let scoreSum = 0;
  let scoreCount = 0;
  let totalCredits = 0;
  let earnedCredits = 0;
  let plannedCredits = 0;
  let failedCredits = 0;
  let failedCount = 0;
  let notGradedCount = 0;

  for (const grade of grades) {
    totalCredits += grade.credits;

    if (grade.score !== null) {
      scoreSum += grade.score;
      scoreCount += 1;
    }

    switch (grade.status) {
      case "PASSED":
        earnedCredits += grade.credits;
        break;
      case "NOT_GRADED":
        plannedCredits += grade.credits;
        notGradedCount += 1;
        break;
      case "FAILED":
        failedCredits += grade.credits;
        failedCount += 1;
        break;
    }
  }

  const isSemesterOverdue = now.getTime() > semester.endsAt.getTime();
  const debtCount = failedCount + (isSemesterOverdue ? notGradedCount : 0);
  const averageScore = scoreCount === 0 ? null : Math.round((scoreSum / scoreCount) * 100) / 100;
  const hasDebts = debtCount > 0;

  return {
    averageScore,
    totalCredits,
    earnedCredits,
    plannedCredits,
    failedCredits,
    debtCount,
    state: hasDebts ? "DEBTS" : "OK",
    message: hasDebts ? formatDebtMessage(debtCount) : OK_MESSAGE,
  };
}
