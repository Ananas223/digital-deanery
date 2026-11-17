import { ArrowRight, Ban, MapPin, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import type { LessonDetailsView } from "@/lib/ui/schedule-details";

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm leading-relaxed text-muted-foreground">{label}</dt>
      <dd className="text-base leading-relaxed wrap-anywhere">{children}</dd>
    </div>
  );
}

/** Full, already-formatted lesson details shared by the modal presentation. */
export function LessonDetailsContent({ lesson }: { lesson: LessonDetailsView }) {
  return (
    <div className="min-w-0 space-y-7 wrap-anywhere">
      <div className="space-y-2">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-3xl leading-tight font-semibold tracking-tight tabular-nums md:text-4xl">
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <time dateTime={lesson.startsAtIso}>{lesson.startsAtLabel}</time>
            <span aria-hidden="true">–</span>
            <span className="sr-only">до</span>
          </span>
          <time dateTime={lesson.endsAtIso} className="whitespace-nowrap">
            {lesson.endsAtLabel}
          </time>
          <span className="text-sm leading-relaxed font-normal tracking-normal text-muted-foreground">
            МСК
          </span>
        </p>
        {lesson.cancelled ? (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-danger-strong">
            <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Занятие отменено. Приходить не нужно.
          </p>
        ) : null}
      </div>

      {lesson.changes.length > 0 ? (
        <section className="space-y-4 border-y border-border py-5">
          <h3 className="text-lg font-medium">Изменения занятия</h3>
          <ol className="space-y-5">
            {lesson.changes.map((change) => (
              <li key={change.key} className="min-w-0 space-y-1.5">
                <p
                  className={
                    change.cancellation
                      ? "font-medium text-danger-strong"
                      : "font-medium text-primary"
                  }
                >
                  {change.label}
                </p>
                {change.before !== null && change.after !== null ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
                    <span className="sr-only">Было: </span>
                    <s className="text-muted-foreground">{change.before}</s>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="sr-only">Стало: </span>
                    <span className="font-medium">{change.after}</span>
                  </p>
                ) : null}
                {change.reason ? <p className="text-sm leading-relaxed">{change.reason}</p> : null}
                {change.remainsCancelled ? (
                  <p className="text-sm leading-relaxed text-danger-strong">
                    Занятие остаётся отменённым.
                  </p>
                ) : null}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Изменено <time dateTime={change.recordedAtIso}>{change.recordedAtLabel}</time> МСК
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <dl className="space-y-5">
        <DetailField label="Аудитория и корпус">
          <span className="flex items-start gap-3">
            <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
            <span>{lesson.room}</span>
          </span>
        </DetailField>
        <DetailField label="Преподаватель">
          <span className="flex items-start gap-3">
            <UserRound aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
            <span>{lesson.teacher}</span>
          </span>
        </DetailField>
        <DetailField label="Тип занятия">{lesson.typeLabel}</DetailField>
        <DetailField label="Группа и подгруппа">
          {lesson.groupCode} · {lesson.subgroupLabel}
        </DetailField>
      </dl>

      {lesson.changes.length > 0 ? (
        <section className="space-y-4 border-t border-border pt-6">
          <h3 className="text-lg font-medium">Первоначально в расписании</h3>
          <dl className="space-y-4">
            <DetailField label="Дата и время">
              <time dateTime={lesson.original.startsAtIso}>
                {lesson.original.dateLabel} · {lesson.original.timeLabel}
              </time>{" "}
              <span className="text-sm text-muted-foreground">МСК</span>
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
