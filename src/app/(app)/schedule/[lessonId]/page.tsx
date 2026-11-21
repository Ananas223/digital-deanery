import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonChanges } from "@/components/schedule/lesson-changes";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getLessonCard, getLessonSubgroupLabel, getLessonTypeLabel } from "@/lib/domain/schedule";
import {
  formatScheduleDate,
  formatScheduleRoom,
  formatScheduleTimeRange,
} from "@/lib/ui/schedule-format";
import { scheduleChangeViews } from "@/lib/ui/schedule-presentation";
import {
  readScheduleContext,
  scheduleDisciplineHref,
  scheduleHref,
  type ScheduleSearchParams,
} from "@/lib/ui/schedule-query";

export const metadata: Metadata = { title: "Занятие — Расписание" };
export const dynamic = "force-dynamic";

type LessonPageProps = {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<ScheduleSearchParams>;
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base leading-relaxed">{children}</dd>
    </div>
  );
}

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const user = await requireUser();
  const { lessonId } = await params;
  const lesson = await getLessonCard(user.id, lessonId);
  if (!lesson) notFound();
  const context = readScheduleContext(await searchParams, new Date(), lesson.effective.startsAt);
  const effective = lesson.effective;
  const changes = scheduleChangeViews(lesson);
  return (
    <div className="min-w-0 space-y-6 wrap-anywhere">
      <Link
        href={scheduleHref(context, context.view === "week")}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />К расписанию
      </Link>
      <PageHeader
        title={effective.discipline.name}
        description={formatScheduleDate(effective.startsAt, { weekday: "long" })}
        className="border-0 pb-0"
      />
      <article className="min-w-0 space-y-6 rounded-card border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xl font-medium tabular-nums sm:text-2xl">
            <time dateTime={effective.startsAt.toISOString()}>
              {formatScheduleTimeRange(effective.startsAt, effective.endsAt)}
            </time>
            <span className="ms-2 text-sm font-normal text-muted-foreground">МСК</span>
          </p>
          <Badge variant={effective.status === "CANCELLED" ? "danger" : "neutral"}>
            {effective.status === "CANCELLED" ? "Отменено" : getLessonTypeLabel(lesson.type)}
          </Badge>
        </div>
        {effective.status === "CANCELLED" ? (
          <Alert tone="danger" title="Занятие отменено">
            На это занятие приходить не нужно. Причина указана в изменениях ниже.
          </Alert>
        ) : null}
        <LessonChanges changes={changes} className="border-t border-border pt-5" />
        <section aria-labelledby="lesson-information" className="space-y-4">
          <h2 id="lesson-information" className="text-lg font-medium">
            Информация о занятии
          </h2>
          <dl className="grid min-w-0 gap-x-8 gap-y-5 sm:grid-cols-2">
            <DetailField label="Дисциплина">{effective.discipline.name}</DetailField>
            <DetailField label="Тип занятия">{getLessonTypeLabel(lesson.type)}</DetailField>
            <DetailField label="Преподаватель">{effective.teacher.fullName}</DetailField>
            <DetailField label="Аудитория и корпус">
              {formatScheduleRoom(effective.room)}
            </DetailField>
            <DetailField label="Группа">{lesson.groupCode}</DetailField>
            <DetailField label="Подгруппа">{getLessonSubgroupLabel(lesson.subgroup)}</DetailField>
          </dl>
        </section>
        {changes.length > 0 ? (
          <section
            aria-labelledby="lesson-original"
            className="space-y-4 border-t border-border pt-5"
          >
            <h2 id="lesson-original" className="text-lg font-medium">
              Первоначально в расписании
            </h2>
            <dl className="grid min-w-0 gap-x-8 gap-y-5 text-muted-foreground sm:grid-cols-2">
              <DetailField label="Дата и время">
                {formatScheduleDate(lesson.original.startsAt)} ·{" "}
                {formatScheduleTimeRange(lesson.original.startsAt, lesson.original.endsAt)}
              </DetailField>
              <DetailField label="Дисциплина">{lesson.original.discipline.name}</DetailField>
              <DetailField label="Преподаватель">{lesson.original.teacher.fullName}</DetailField>
              <DetailField label="Аудитория и корпус">
                {formatScheduleRoom(lesson.original.room)}
              </DetailField>
            </dl>
          </section>
        ) : null}
      </article>
      <Link
        href={scheduleDisciplineHref(effective.discipline.id, context)}
        className="inline-flex min-h-11 items-center rounded-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Успеваемость по дисциплине
      </Link>
    </div>
  );
}
