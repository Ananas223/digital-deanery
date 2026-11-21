import { ArrowRight, ArrowRightLeft, Ban, MapPin, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { LessonStateLabel } from "@/components/schedule/lesson-state-label";
import { LessonStateMarker } from "@/components/schedule/lesson-state-marker";
import type { LessonDetailsView } from "@/lib/ui/schedule-details";

function DetailField({
  label,
  children,
  prominent = false,
}: {
  label: string;
  children: ReactNode;
  prominent?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className={prominent ? "text-lesson-room wrap-anywhere" : "text-meta wrap-anywhere"}>
        {children}
      </dd>
    </div>
  );
}

/** Full, already-formatted lesson details shared by the modal presentation. */
export function LessonDetailsContent({ lesson }: { lesson: LessonDetailsView }) {
  return (
    <div className="min-w-0 space-y-6 wrap-anywhere">
      <div className="space-y-3">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-3xl leading-tight font-semibold tracking-tight tabular-nums md:text-4xl">
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <time dateTime={lesson.startsAtIso}>{lesson.startsAtLabel}</time>
            <span aria-hidden="true">–</span>
            <span className="sr-only">до</span>
          </span>
          <time dateTime={lesson.endsAtIso} className="whitespace-nowrap">
            {lesson.endsAtLabel}
          </time>
          <span className="text-caption font-normal tracking-normal text-muted-foreground">
            МСК
          </span>
        </p>
        {lesson.cancelled ? (
          <p className="flex flex-wrap items-center gap-2 text-meta text-danger-strong">
            <LessonStateMarker cancelled />
            <LessonStateLabel cancelled className="text-meta" />
            <span>Приходить не нужно.</span>
          </p>
        ) : null}
        <dl>
          <DetailField label="Аудитория и корпус" prominent>
            <span className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-link" />
              <span>{lesson.room}</span>
            </span>
          </DetailField>
        </dl>
      </div>

      {lesson.changes.length > 0 ? (
        <section className="space-y-4 border-y border-border py-5">
          <h3 className="text-lg font-semibold">Изменения занятия</h3>
          <ol className="space-y-5">
            {lesson.changes.map((change) => {
              const ChangeIcon = change.cancellation ? Ban : ArrowRightLeft;

              return (
                <li key={change.key} className="min-w-0 space-y-1.5">
                  <p
                    className={
                      change.cancellation
                        ? "flex items-start gap-2 text-meta font-medium text-danger-strong"
                        : "flex items-start gap-2 text-meta font-medium text-link"
                    }
                  >
                    <ChangeIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>{change.label}</span>
                  </p>
                  {change.before !== null && change.after !== null ? (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
                      <span className="sr-only">Было: </span>
                      <s className="text-muted-foreground">{change.before}</s>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                      <span className="sr-only">Стало: </span>
                      <span className="font-medium">{change.after}</span>
                    </p>
                  ) : null}
                  {change.reason ? <p className="text-meta text-pretty">{change.reason}</p> : null}
                  {change.remainsCancelled ? (
                    <p className="text-meta text-danger-strong">Занятие остаётся отменённым.</p>
                  ) : null}
                  <p className="text-caption text-muted-foreground">
                    Изменено <time dateTime={change.recordedAtIso}>{change.recordedAtLabel}</time>{" "}
                    МСК
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <dl className="space-y-4">
        <DetailField label="Преподаватель">
          <span className="flex items-start gap-2">
            <UserRound
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <span>{lesson.teacher}</span>
          </span>
        </DetailField>
        <DetailField label="Тип занятия">{lesson.typeLabel}</DetailField>
        <DetailField label="Группа и подгруппа">
          {lesson.groupCode} · {lesson.subgroupLabel}
        </DetailField>
      </dl>

      {lesson.changes.length > 0 ? (
        <section className="space-y-4 border-t border-border pt-5">
          <h3 className="text-lg font-semibold">Первоначально в расписании</h3>
          <dl className="space-y-4">
            <DetailField label="Дата и время">
              <time dateTime={lesson.original.startsAtIso}>
                {lesson.original.dateLabel} · {lesson.original.timeLabel}
              </time>{" "}
              <span className="text-caption text-muted-foreground">МСК</span>
            </DetailField>
            <DetailField label="Дисциплина">{lesson.original.title}</DetailField>
            <DetailField label="Преподаватель">{lesson.original.teacher}</DetailField>
            <DetailField label="Аудитория и корпус">{lesson.original.room}</DetailField>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
