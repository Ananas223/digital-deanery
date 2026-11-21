import "server-only";

import Link from "next/link";

import { GradesRetry } from "@/components/grades/grades-retry";
import { EmptyState } from "@/components/ui/empty-state";
import { getLessonTypeLabel, getWeekSchedule, type ScheduleWeek } from "@/lib/domain/schedule";
import { getMoscowDateKey } from "@/lib/domain/schedule-time";
import { formatDate } from "@/lib/format";
import { formatScheduleRoom, formatScheduleTimeRange } from "@/lib/ui/schedule-format";
import { readScheduleContext, scheduleLessonHref } from "@/lib/ui/schedule-query";

export async function RelatedLessons({
  userId,
  disciplineId,
  semesterId,
  now,
}: {
  userId: string;
  disciplineId: string;
  semesterId: string;
  now: Date;
}) {
  let week: ScheduleWeek | null;
  try {
    week = await getWeekSchedule(userId, now);
  } catch {
    return (
      <GradesRetry
        title="Не удалось загрузить занятия"
        description="Оценки и сессия доступны. Повторите загрузку занятий текущей недели — выбранная дисциплина сохранится."
      />
    );
  }

  if (!week) {
    return (
      <EmptyState
        title="Занятия пока недоступны"
        description="Не удалось найти учебную группу для показа занятий текущей недели. Проверьте данные в профиле."
        action={
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Открыть профиль
          </Link>
        }
      />
    );
  }

  const lessons = week.days
    .flatMap((day) => day.lessons)
    .filter((lesson) => lesson.effective.discipline.id === disciplineId);
  const firstDay = week.days[0];
  const lastDay = week.days[week.days.length - 1];
  return (
    <section aria-labelledby="related-lessons-heading" className="min-w-0 space-y-3">
      <div className="space-y-1">
        <h3 id="related-lessons-heading" className="text-lg leading-7 font-medium">
          Занятия текущей недели
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {firstDay && lastDay
            ? `${formatDate(firstDay.startsAt)}–${formatDate(lastDay.startsAt)}. `
            : ""}
          Показаны только занятия этой недели, а не всего семестра.
        </p>
      </div>
      {lessons.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          На текущей неделе нет занятий по этой дисциплине.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {lessons.map((lesson) => {
            const context = readScheduleContext(
              { day: getMoscowDateKey(lesson.effective.startsAt), semesterId },
              now,
            );
            return (
              <li key={lesson.id} className="min-w-0 space-y-1 py-3">
                <Link
                  href={scheduleLessonHref(lesson.id, context)}
                  className="inline-flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 py-2 text-base font-medium text-link underline decoration-link/30 underline-offset-4 hover:decoration-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span>{getLessonTypeLabel(lesson.type)}</span>
                  <span className="tabular-nums">
                    {formatDate(lesson.effective.startsAt)} ·{" "}
                    {formatScheduleTimeRange(lesson.effective.startsAt, lesson.effective.endsAt)}{" "}
                    МСК
                  </span>
                </Link>
                {lesson.effective.status === "CANCELLED" ? (
                  <p className="text-sm font-medium text-danger-strong">Занятие отменено</p>
                ) : null}
                <p className="text-sm leading-6 text-muted-foreground">
                  {formatScheduleRoom(lesson.effective.room)}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Преподаватель: {lesson.effective.teacher.fullName}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
