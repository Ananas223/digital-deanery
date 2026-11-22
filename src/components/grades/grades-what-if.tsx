"use client";

import { useId, useMemo, useState } from "react";

import { Select } from "@/components/ui/select";
import {
  buildWhatIfPlan,
  type ForecastGrade,
  type WhatIfTarget,
} from "@/lib/domain/grades-forecast";

export type WhatIfCandidateOption = {
  disciplineId: string;
  disciplineName: string;
};

const TARGET_OPTIONS: { value: WhatIfTarget; label: string }[] = [
  { value: 4.5, label: "4,5" },
  { value: 5, label: "5" },
];

function formatTarget(target: WhatIfTarget): string {
  return target === 5 ? "5" : "4,5";
}

/**
 * «А если?» (`Ф-03.10`): студент выбирает дисциплину без оценки и целевое
 * среднее, а блок показывает нужный балл или честную недостижимость.
 * Расчёт выполняется в браузере на чистых функциях и ничего не сохраняет.
 */
export function GradesWhatIf({
  grades,
  candidates,
}: {
  grades: ForecastGrade[];
  candidates: WhatIfCandidateOption[];
}) {
  const disciplineSelectId = useId();
  const targetSelectId = useId();
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>("");
  const [target, setTarget] = useState<WhatIfTarget>(4.5);

  const plan = useMemo(() => buildWhatIfPlan(grades, { target }), [grades, target]);

  const firstCandidate = candidates.at(0);
  if (!firstCandidate) {
    return null;
  }

  const effectiveDisciplineId = candidates.some(
    (candidate) => candidate.disciplineId === selectedDisciplineId,
  )
    ? selectedDisciplineId
    : firstCandidate.disciplineId;
  const selectedCandidate =
    plan.candidates.find((candidate) => candidate.disciplineId === effectiveDisciplineId) ?? null;

  return (
    <section
      aria-labelledby="grades-what-if"
      className="min-w-0 space-y-4 rounded-card border border-border p-5 wrap-anywhere sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="grades-what-if" className="text-xl font-medium">
          А если?
        </h2>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Выберите дисциплину без числовой оценки и целевое среднее — увидите, какой балл нужен.
          Расчёт ничего не сохраняет.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <label htmlFor={disciplineSelectId} className="block text-sm font-medium text-foreground">
            Дисциплина без оценки
          </label>
          <Select
            id={disciplineSelectId}
            value={effectiveDisciplineId}
            onChange={(event) => setSelectedDisciplineId(event.target.value)}
          >
            {candidates.map((candidate) => (
              <option key={candidate.disciplineId} value={candidate.disciplineId}>
                {candidate.disciplineName}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor={targetSelectId} className="block text-sm font-medium text-foreground">
            Целевое среднее
          </label>
          <Select
            id={targetSelectId}
            value={String(target)}
            onChange={(event) => setTarget(event.target.value === "5" ? 5 : 4.5)}
          >
            {TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {selectedCandidate ? (
        <div className="min-w-0 space-y-2 rounded-card border border-border bg-primary-muted p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {selectedCandidate.disciplineName} · цель {formatTarget(target)}
          </p>
          <p className="text-lg leading-7 font-medium text-foreground tabular-nums">
            {selectedCandidate.reachable && selectedCandidate.requiredScore !== null
              ? `Нужен балл ${selectedCandidate.requiredScore}`
              : "Цель недостижима"}
          </p>
          <p className="max-w-prose text-sm leading-6 text-foreground">
            {selectedCandidate.message}
          </p>
        </div>
      ) : null}
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        Допущения: нужный балл = max(3, ceil(цель × (n + 1) − сумма)), где n — текущие числовые
        оценки, сумма — их сумма. Балл ограничен диапазоном 3–5; если даже 5 не хватает, цель
        недостижима. Данные не меняются.
      </p>
    </section>
  );
}
