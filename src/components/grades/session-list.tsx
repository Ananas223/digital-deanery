import "server-only";

import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { GradeResult } from "@/components/grades/grade-result";
import { EmptyState } from "@/components/ui/empty-state";
import { getAssessmentTypeLabel, type SessionExam } from "@/lib/domain/grades";
import { formatDate, formatDateTime } from "@/lib/format";
import { gradesHref, type GradesContext } from "@/lib/ui/grades-query";
import { formatScheduleTimeRange } from "@/lib/ui/schedule-format";

export function formatSessionRoom(room: SessionExam["room"]): string {
  if (!room) return "Не назначена";
  return `Ауд. ${room.number}${room.name ? ` (${room.name})` : ""} · корпус ${room.buildingCode}`;
}

export function SessionExamDetails({ exam }: { exam: SessionExam }) {
  return (
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="min-w-0 space-y-1">
        <dt className="text-sm leading-6 text-muted-foreground">Начало, МСК</dt>
        <dd className="text-base leading-6 tabular-nums">
          <time dateTime={exam.startsAt.toISOString()}>{formatDateTime(exam.startsAt)}</time>
        </dd>
      </div>
      <div className="min-w-0 space-y-1">
        <dt className="text-sm leading-6 text-muted-foreground">Окончание, МСК</dt>
        <dd className="text-base leading-6 tabular-nums">
          <time dateTime={exam.endsAt.toISOString()}>{formatDateTime(exam.endsAt)}</time>
        </dd>
      </div>
      <div className="min-w-0 space-y-1">
        <dt className="text-sm leading-6 text-muted-foreground">Форма контроля</dt>
        <dd className="text-base leading-6">{getAssessmentTypeLabel(exam.assessmentType)}</dd>
      </div>
      <div className="min-w-0 space-y-1">
        <dt className="text-sm leading-6 text-muted-foreground">Аудитория</dt>
        <dd className="text-base leading-6">{formatSessionRoom(exam.room)}</dd>
      </div>
      <div className="min-w-0 space-y-1">
        <dt className="text-sm leading-6 text-muted-foreground">Преподаватель</dt>
        <dd className="text-base leading-6">{exam.teacherName ?? "Не указан"}</dd>
      </div>
      <div className="min-w-0 space-y-1">
        <dt className="text-sm leading-6 text-muted-foreground">Результат</dt>
        <dd className="text-base leading-6">
          <GradeResult result={exam.result} />
        </dd>
      </div>
    </dl>
  );
}

function SessionGroup({
  title,
  exams,
  context,
  now,
}: {
  title: string;
  exams: SessionExam[];
  context: GradesContext;
  now: Date;
}) {
  if (exams.length === 0) return null;
  return (
    <section aria-label={title} className="min-w-0">
      <h2 className="pb-3 text-xl font-medium">{title}</h2>
      <ol className="divide-y divide-border border-y border-border">
        {exams.map((exam) => (
          <li key={exam.id} className="min-w-0 space-y-4 py-5 sm:py-6">
            <div className="min-w-0 space-y-1">
              <p className="text-sm leading-6 font-medium text-link tabular-nums">
                <time dateTime={exam.startsAt.toISOString()}>{formatDate(exam.startsAt)}</time>
                {" · "}
                {formatScheduleTimeRange(exam.startsAt, exam.endsAt)} МСК
                {exam.startsAt.getTime() <= now.getTime() && exam.endsAt.getTime() > now.getTime()
                  ? " · Идёт сейчас"
                  : ""}
              </p>
              <h3 className="text-xl leading-7 font-medium">
                <Link
                  href={gradesHref(
                    { ...context, disciplineId: exam.discipline.id },
                    "discipline-detail",
                  )}
                  className="inline-flex min-h-11 items-center text-link underline decoration-link/30 underline-offset-4 hover:decoration-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {exam.discipline.name}
                </Link>
              </h3>
            </div>
            <SessionExamDetails exam={exam} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SessionList({
  session,
  context,
  now,
}: {
  session: SessionExam[];
  context: GradesContext;
  now: Date;
}) {
  if (session.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="В сессии пока нет записей"
        description="Для выбранного семестра ещё не добавлены даты экзаменов и зачётов. Оценки по дисциплинам можно посмотреть в разделе «Оценки»."
      />
    );
  }

  const upcoming = session.filter((exam) => exam.endsAt.getTime() > now.getTime());
  const past = session.filter((exam) => exam.endsAt.getTime() <= now.getTime());
  return (
    <div className="min-w-0 space-y-8">
      {upcoming.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Предстоящих испытаний в этом семестре нет. Ниже — прошедшие экзамены и зачёты.
        </p>
      ) : null}
      <SessionGroup title="Предстоящие и текущие" exams={upcoming} context={context} now={now} />
      <SessionGroup title="Прошедшие" exams={past} context={context} now={now} />
    </div>
  );
}
