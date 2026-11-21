import "server-only";

import Link from "next/link";

import { getAssessmentTypeLabel, type SemesterOverview } from "@/lib/domain/grades";
import { buildGradesSummary } from "@/lib/domain/grades-summary";
import { formatDateTime, formatNumber } from "@/lib/format";
import { gradesHref, type GradesContext } from "@/lib/ui/grades-query";
import { cn } from "@/lib/utils";

export function GradesSummary({
  overview,
  context,
  now,
}: {
  overview: SemesterOverview;
  context: GradesContext;
  now: Date;
}) {
  const { summary } = overview;
  const nextExam = overview.session.find((exam) => exam.endsAt.getTime() > now.getTime());
  const debts = overview.grades.filter(
    (grade) => buildGradesSummary([grade], overview.semester, now).debtCount > 0,
  );
  return (
    <section
      aria-labelledby="semester-summary"
      className="min-w-0 space-y-4 rounded-card border border-border bg-primary-muted p-5 wrap-anywhere sm:p-6"
    >
      <div className="space-y-2">
        <h2 id="semester-summary" className="text-xl font-medium">
          Итог семестра
        </h2>
        <p
          className={cn(
            "text-lg leading-7 font-medium",
            summary.state === "DEBTS" ? "text-danger-strong" : "text-foreground",
          )}
        >
          {summary.message}
        </p>
        {summary.state !== "NO_DATA" ? (
          <p className="max-w-prose text-sm leading-6 text-foreground">
            {summary.averageScore !== null ? (
              <>
                Средний балл —{" "}
                <strong className="font-semibold tabular-nums">
                  {formatNumber(summary.averageScore, { maximumFractionDigits: 2 })} из 5
                </strong>
                .{" "}
              </>
            ) : null}
            Зачётные единицы: получено{" "}
            <span className="font-medium tabular-nums">
              {formatNumber(summary.earnedCredits)} из {formatNumber(summary.totalCredits)}
            </span>
            ; ожидают результата —{" "}
            <span className="tabular-nums">{formatNumber(summary.plannedCredits)}</span>; по
            незачтённым дисциплинам —{" "}
            <span className="tabular-nums">{formatNumber(summary.failedCredits)}</span>.
          </p>
        ) : (
          <p className="max-w-prose text-sm leading-6 text-foreground">
            Сводка появится, когда в семестре будут добавлены результаты по дисциплинам.
          </p>
        )}
      </div>
      {summary.state === "DEBTS" && debts.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-base font-medium">Дисциплины с задолженностью</h3>
          <p className="text-sm leading-6 text-foreground">
            Откройте дисциплину, чтобы проверить результат и преподавателя.
          </p>
          <ul className="space-y-1">
            {debts.map((grade) => (
              <li key={grade.id} className="min-w-0">
                <Link
                  href={gradesHref(
                    { ...context, tab: "grades", disciplineId: grade.discipline.id },
                    "discipline-detail",
                  )}
                  className="inline-flex min-h-11 min-w-0 items-center py-2 font-medium text-link underline decoration-link/40 underline-offset-4 hover:decoration-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {grade.discipline.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="border-t border-border pt-4 text-sm leading-6 text-foreground">
        {nextExam ? (
          <>
            <p className="font-medium">
              {nextExam.startsAt.getTime() <= now.getTime()
                ? "Контроль идёт сейчас"
                : "Ближайший контроль"}
            </p>
            <Link
              href={gradesHref(
                { ...context, tab: "session", disciplineId: nextExam.discipline.id },
                "discipline-detail",
              )}
              className="inline-flex min-h-11 min-w-0 items-center py-2 font-medium text-link underline decoration-link/40 underline-offset-4 hover:decoration-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {nextExam.discipline.name}
            </Link>
            <p>
              {getAssessmentTypeLabel(nextExam.assessmentType)} ·{" "}
              {formatDateTime(nextExam.startsAt)} МСК
            </p>
          </>
        ) : (
          <p>
            {overview.session.length === 0
              ? "В этом семестре пока нет записей сессии."
              : "Предстоящих испытаний в этом семестре нет."}
          </p>
        )}
      </div>
    </section>
  );
}
