import "server-only";

import type { Route } from "next";

import {
  getLessonSubgroupLabel,
  getLessonTypeLabel,
  type LessonSnapshot,
  type ScheduleLesson,
} from "@/lib/domain/schedule";
import { formatDateTime } from "@/lib/format";
import {
  formatScheduleDate,
  formatScheduleRoom,
  formatScheduleTime,
  formatScheduleTimeRange,
} from "@/lib/ui/schedule-format";
import { scheduleChangeViews, type ScheduleChangeView } from "@/lib/ui/schedule-presentation";
import {
  scheduleDisciplineHref,
  scheduleLessonHref,
  type ScheduleContext,
} from "@/lib/ui/schedule-query";

export type LessonDetailsSnapshotView = {
  title: string;
  dateLabel: string;
  timeLabel: string;
  startsAtLabel: string;
  endsAtLabel: string;
  startsAtIso: string;
  endsAtIso: string;
  teacher: string;
  room: string;
};

export type LessonDetailsChangeView = ScheduleChangeView & {
  recordedAtIso: string;
  recordedAtLabel: string;
};

/** Serializable presentation only; no domain, Prisma or session objects reach the client. */
export type LessonDetailsView = LessonDetailsSnapshotView & {
  id: string;
  href: Route;
  typeLabel: string;
  subgroupLabel: string;
  groupCode: string;
  cancelled: boolean;
  disciplineHref: Route;
  changes: LessonDetailsChangeView[];
  original: LessonDetailsSnapshotView;
};

function snapshotView(snapshot: LessonSnapshot): LessonDetailsSnapshotView {
  return {
    title: snapshot.discipline.name,
    dateLabel: formatScheduleDate(snapshot.startsAt, { weekday: "long" }),
    timeLabel: formatScheduleTimeRange(snapshot.startsAt, snapshot.endsAt),
    startsAtLabel: formatScheduleTime(snapshot.startsAt),
    endsAtLabel: formatScheduleTime(snapshot.endsAt),
    startsAtIso: snapshot.startsAt.toISOString(),
    endsAtIso: snapshot.endsAt.toISOString(),
    teacher: snapshot.teacher.fullName,
    room: formatScheduleRoom(snapshot.room),
  };
}

/** Project the already-authorized full lesson; resolution and access stay in the domain. */
export function lessonDetailsView(
  lesson: ScheduleLesson,
  context: ScheduleContext,
): LessonDetailsView {
  const changeViews = scheduleChangeViews(lesson);
  return {
    ...snapshotView(lesson.effective),
    id: lesson.id,
    href: scheduleLessonHref(lesson.id, context),
    typeLabel: getLessonTypeLabel(lesson.type),
    subgroupLabel: getLessonSubgroupLabel(lesson.subgroup),
    groupCode: lesson.groupCode,
    cancelled: lesson.effective.status === "CANCELLED",
    disciplineHref: scheduleDisciplineHref(lesson.effective.discipline.id, context),
    changes: lesson.changes.map((change, index) => ({
      ...changeViews[index]!,
      recordedAtIso: change.createdAt.toISOString(),
      recordedAtLabel: formatDateTime(change.createdAt),
    })),
    original: snapshotView(lesson.original),
  };
}
