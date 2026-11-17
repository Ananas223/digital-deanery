import "server-only";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { GradeResult } from "@/components/grades/grade-result";
import { RelatedLessons } from "@/components/grades/related-lessons";
import { SessionExamDetails } from "@/components/grades/session-list";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getAssessmentTypeLabel, type SemesterOverview } from "@/lib/domain/grades";
import { formatNumber } from "@/lib/format";
import { gradesHref, type GradesContext } from "@/lib/ui/grades-query";

export function DisciplineDetail({
  overview,
  context,
  userId,
  now,
  invalidDiscipline = false,
}: {
  overview: SemesterOverview;
  context: GradesContext;
  userId: string;
  now: Date;
  invalidDiscipline?: boolean;
}) {
  const grade = overview.grades.find((entry) => entry.discipline.id === context.disciplineId);
  const exams = overview.session.filter((exam) => exam.discipline.id === context.disciplineId);
  const discipline = grade?.discipline ?? exams[0]?.discipline;
  const returnHref = gradesHref({ ...context, disciplineId: undefined }, "grades-content");

  if (invalidDiscipline || !discipline) {
    return (
      <div
        id="discipline-detail"
        tabIndex={-1}
        className="min-w-0 scroll-mt-6 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <EmptyState
          icon={BookOpen}
          title="Дисциплина не найдена"
          description="В выбранном семестре нет доступных сведений по этой дисциплине. Проверьте ссылку или вернитесь к списку."
          action={
            <Link href={returnHref} className={buttonVariants({ variant: "outline" })}>
              {context.tab === "session" ? "К списку сессии" : "К списку дисциплин"}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <section
      id="discipline-detail"
      aria-labelledby="discipline-detail-heading"
      tabIndex={-1}
      className="min-w-0 scroll-mt-6 space-y-6 rounded-card border border-border bg-card p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-6"
    >
      <div className="min-w-0 space-y-3">
        <Link
          href={returnHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-link underline underline-offset-4 hover:decoration-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {context.tab === "session" ? "К списку сессии" : "К списку дисциплин"}
        </Link>
        <h2 id="discipline-detail-heading" className="text-2xl leading-8 font-semibold">
          {discipline.name}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Код дисциплины: {discipline.code}. Данные выбранного семестра доступны только для
          просмотра.
        </p>
      </div>
      {grade ? (
        <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <dt className="text-sm leading-6 text-muted-foreground">Форма контроля</dt>
            <dd className="text-base leading-6">{getAssessmentTypeLabel(grade.assessmentType)}</dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm leading-6 text-muted-foreground">Результат</dt>
            <dd className="text-base leading-6">
              <GradeResult result={grade} />
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm leading-6 text-muted-foreground">Преподаватель</dt>
            <dd className="text-base leading-6">{grade.teacherName ?? "Не указан"}</dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm leading-6 text-muted-foreground">Зачётные единицы</dt>
            <dd className="text-base leading-6 tabular-nums">{formatNumber(grade.credits)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          Итоговый результат по дисциплине ещё не внесён.
        </p>
      )}
      <section
        aria-labelledby="discipline-exams-heading"
        className="min-w-0 space-y-3 border-t border-border pt-5"
      >
        <h3 id="discipline-exams-heading" className="text-lg leading-7 font-medium">
          Сессия по дисциплине
        </h3>
        {exams.length > 0 ? (
          <ul className="space-y-5">
            {exams.map((exam) => (
              <li key={exam.id}>
                <SessionExamDetails exam={exam} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            В выбранном семестре нет записи сессии по этой дисциплине.
          </p>
        )}
      </section>
      <div className="border-t border-border pt-5">
        <Suspense
          fallback={
            <div role="status" aria-label="Загружаем занятия текущей недели" className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          }
        >
          <RelatedLessons
            userId={userId}
            disciplineId={discipline.id}
            semesterId={overview.semester.id}
            now={now}
          />
        </Suspense>
      </div>
    </section>
  );
}
