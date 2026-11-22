import { BookOpen, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DisciplineDetail } from "@/components/grades/discipline-detail";
import { GradesForecast } from "@/components/grades/grades-forecast";
import { GradesList } from "@/components/grades/grades-list";
import { GradesSemesterSelector, GradesViewLinks } from "@/components/grades/grades-navigation";
import { GradesRetry } from "@/components/grades/grades-retry";
import { GradesSummary } from "@/components/grades/grades-summary";
import { GradesWhatIf } from "@/components/grades/grades-what-if";
import { SessionList } from "@/components/grades/session-list";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getSemesterLabel, getSemesterOverview, getSemesters } from "@/lib/domain/grades";
import { getWhatIfCandidates, toForecastGrade } from "@/lib/domain/grades-forecast";
import { getStudentProfile } from "@/lib/domain/profile";
import {
  gradesHref,
  readGradesContext,
  type GradesContext,
  type GradesSearchParams,
} from "@/lib/ui/grades-query";

export const metadata: Metadata = { title: "Успеваемость" };
export const dynamic = "force-dynamic";

type GradesPageProps = { searchParams: Promise<GradesSearchParams> };

export default async function GradesPage({ searchParams }: GradesPageProps) {
  const user = await requireUser();
  const now = new Date();
  const query = readGradesContext(await searchParams);
  const [semestersResult, overviewResult, profileResult] = await Promise.allSettled([
    getSemesters(user.id, now),
    query.invalidSemester
      ? Promise.resolve(null)
      : getSemesterOverview(user.id, query.semesterId, now),
    getStudentProfile(user.id),
  ]);
  const semesters = semestersResult.status === "fulfilled" ? semestersResult.value : null;
  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const profile = profileResult.status === "fulfilled" ? profileResult.value : undefined;
  const context: GradesContext = {
    semesterId: overview?.semester.id ?? query.semesterId,
    disciplineId: query.disciplineId,
    tab: query.tab,
  };

  if (profile === null) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader title="Успеваемость" />
        <EmptyState
          icon={UserRound}
          title="Учебный профиль пока не заполнен"
          description="Для вашего аккаунта ещё не указан учебный профиль. Откройте профиль, чтобы проверить доступные данные."
          action={
            <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
              Открыть профиль
            </Link>
          }
        />
      </div>
    );
  }

  const failedToResolveEmptyState =
    !overview && (semesters === null || (semesters.length === 0 && profile === undefined));
  const forecastGrades = overview ? overview.grades.map(toForecastGrade) : [];
  const whatIfCandidates = getWhatIfCandidates(forecastGrades).map((grade) => ({
    disciplineId: grade.disciplineId,
    disciplineName: grade.disciplineName,
  }));
  return (
    <div className="min-w-0 space-y-6 wrap-anywhere sm:space-y-8">
      <PageHeader
        title="Успеваемость"
        description={
          overview
            ? `${getSemesterLabel(overview.semester)}. Результаты доступны только для просмотра.`
            : "Оценки, результаты и сессия по вашим семестрам."
        }
      />
      {semesters ? (
        <GradesSemesterSelector
          semesters={semesters}
          selectedSemesterId={overview?.semester.id ?? query.semesterId}
          context={context}
        />
      ) : null}
      {semesters === null && overview ? (
        <GradesRetry
          title="Не удалось загрузить список семестров"
          description="Данные выбранного семестра доступны. Повторите загрузку, чтобы выбрать другой семестр."
        />
      ) : null}
      {overview ? <GradesSummary overview={overview} context={context} now={now} /> : null}
      {overview ? <GradesForecast overview={overview} now={now} /> : null}
      {overview ? <GradesWhatIf grades={forecastGrades} candidates={whatIfCandidates} /> : null}
      <GradesViewLinks context={context} />
      {overviewResult.status === "rejected" || failedToResolveEmptyState ? (
        <GradesRetry />
      ) : query.invalidSemester || (query.semesterId && !overview) ? (
        <EmptyState
          icon={BookOpen}
          title="Семестр не найден"
          description="По этой ссылке нет доступных данных семестра. Проверьте ссылку или откройте семестр по умолчанию."
          action={
            <Link
              href={gradesHref({ tab: query.tab })}
              className={buttonVariants({ variant: "outline" })}
            >
              К доступному семестру
            </Link>
          }
        />
      ) : !overview ? (
        <EmptyState
          icon={BookOpen}
          title="Семестры пока не добавлены"
          description="Для вашего учебного профиля пока нет семестров с оценками и расписанием сессии. Вы можете перейти к своему расписанию занятий."
          action={
            <Link href="/schedule" className={buttonVariants({ variant: "outline" })}>
              К расписанию
            </Link>
          }
        />
      ) : (
        <>
          {context.disciplineId || query.invalidDiscipline ? (
            <DisciplineDetail
              overview={overview}
              context={context}
              userId={user.id}
              now={now}
              invalidDiscipline={query.invalidDiscipline}
            />
          ) : null}
          <div
            id="grades-content"
            tabIndex={-1}
            className="min-w-0 scroll-mt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {context.tab === "session" ? (
              <SessionList
                session={overview.session}
                publication={overview.sessionPublication}
                context={context}
                now={now}
              />
            ) : (
              <GradesList grades={overview.grades} context={context} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
