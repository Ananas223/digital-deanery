import "server-only";

import { BookOpen } from "lucide-react";
import Link from "next/link";

import { GradeResult } from "@/components/grades/grade-result";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getAssessmentTypeLabel, type GradeEntry } from "@/lib/domain/grades";
import { formatNumber } from "@/lib/format";
import { gradesHref, type GradesContext } from "@/lib/ui/grades-query";

export function GradesList({ grades, context }: { grades: GradeEntry[]; context: GradesContext }) {
  if (grades.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="За семестр пока нет оценок"
        description="Для выбранного семестра ещё не добавлены результаты по дисциплинам. Можно открыть семестр по умолчанию или посмотреть расписание сессии."
        action={
          <Link
            href={gradesHref({ tab: "grades" })}
            className={buttonVariants({ variant: "outline" })}
          >
            К доступному семестру
          </Link>
        }
      />
    );
  }

  return (
    <section aria-labelledby="disciplines-heading" className="min-w-0">
      <h2 id="disciplines-heading" className="pb-3 text-xl font-medium">
        Дисциплины и результаты
      </h2>
      <ul className="divide-y divide-border border-y border-border">
        {grades.map((grade) => (
          <li key={grade.id} className="grid min-w-0 gap-4 py-5 lg:grid-cols-12 lg:gap-6 lg:py-6">
            <div className="min-w-0 space-y-2 lg:col-span-5">
              <h3 className="text-xl leading-7 font-medium">
                <Link
                  href={gradesHref(
                    { ...context, disciplineId: grade.discipline.id },
                    "discipline-detail",
                  )}
                  className="inline-flex min-h-11 items-center text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {grade.discipline.name}
                </Link>
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                <span>Преподаватель: </span>
                {grade.teacherName ?? "Не указан"}
              </p>
            </div>
            <dl className="grid min-w-0 gap-4 sm:grid-cols-3 lg:col-span-7">
              <div className="min-w-0 space-y-1">
                <dt className="text-sm leading-6 text-muted-foreground">Форма контроля</dt>
                <dd className="text-base leading-6">
                  {getAssessmentTypeLabel(grade.assessmentType)}
                </dd>
              </div>
              <div className="min-w-0 space-y-1">
                <dt className="text-sm leading-6 text-muted-foreground">Зачётные единицы</dt>
                <dd className="text-base leading-6 tabular-nums">{formatNumber(grade.credits)}</dd>
              </div>
              <div className="min-w-0 space-y-1">
                <dt className="text-sm leading-6 text-muted-foreground">Результат</dt>
                <dd className="text-base leading-6">
                  <GradeResult result={grade} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
