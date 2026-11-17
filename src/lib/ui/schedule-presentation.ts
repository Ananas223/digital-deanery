import type { Route } from "next";

import {
  getLessonSubgroupLabel,
  getLessonTypeLabel,
  type ScheduleLesson,
} from "@/lib/domain/schedule";
import { getLessonChangeLabel, resolveLessonState } from "@/lib/domain/schedule-changes";
import { getMoscowDateKey } from "@/lib/domain/schedule-time";
import {
  formatScheduleDate,
  formatScheduleRoom,
  formatScheduleRoomCompact,
  formatScheduleTeacherCompact,
  formatScheduleTimeRange,
} from "@/lib/ui/schedule-format";
import { scheduleLessonHref, type ScheduleContext } from "@/lib/ui/schedule-query";

type SchedulePresentationOptions = { compact?: boolean };

export type ScheduleChangeView = {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  reason: string | null;
  cancellation: boolean;
  remainsCancelled: boolean;
};

export type ScheduleLessonView = {
  id: string;
  href: Route;
  title: string;
  typeLabel: string;
  subgroupLabel: string | null;
  timeLabel: string;
  startsAt: number;
  endsAt: number;
  startsAtIso: string;
  endsAtIso: string;
  teacher: string;
  room: string;
  cancelled: boolean;
  changes: ScheduleChangeView[];
};

function changedTime(startsAt: Date, endsAt: Date, includeDate: boolean): string {
  const time = formatScheduleTimeRange(startsAt, endsAt);
  return includeDate ? `${formatScheduleDate(startsAt)} · ${time}` : time;
}

/** The existing resolver supplies each history snapshot; presentation does not resolve changes. */
export function scheduleChangeViews(
  lesson: ScheduleLesson,
  options: SchedulePresentationOptions = {},
): ScheduleChangeView[] {
  const roomLabel = options.compact ? formatScheduleRoomCompact : formatScheduleRoom;
  const teacherLabel = options.compact ? formatScheduleTeacherCompact : (name: string) => name;
  return lesson.changes.map((change, index) => {
    const before = resolveLessonState(lesson.original, lesson.changes.slice(0, index));
    const after = resolveLessonState(lesson.original, lesson.changes.slice(0, index + 1));
    let previous: string | null = null;
    let next: string | null = null;

    switch (change.type) {
      case "TIME_CHANGE": {
        const includeDate = getMoscowDateKey(before.startsAt) !== getMoscowDateKey(after.startsAt);
        previous = changedTime(before.startsAt, before.endsAt, includeDate);
        next = changedTime(after.startsAt, after.endsAt, includeDate);
        break;
      }
      case "ROOM_CHANGE":
        previous = roomLabel(before.room);
        next = roomLabel(after.room);
        break;
      case "TEACHER_CHANGE":
        previous = teacherLabel(before.teacher.fullName);
        next = teacherLabel(after.teacher.fullName);
        break;
      case "LESSON_REPLACEMENT":
        previous = before.discipline.name;
        next = after.discipline.name;
        break;
    }

    return {
      key: `${index}-${change.type}`,
      label: change.type === "CANCELLATION" ? "Отменено" : getLessonChangeLabel(change.type),
      before: previous,
      after: next,
      reason: change.reason,
      cancellation: change.type === "CANCELLATION",
      remainsCancelled: before.status === "CANCELLED" && change.type !== "CANCELLATION",
    };
  });
}

/** Only display fields and detail links cross the client boundary. */
export function scheduleLessonView(
  lesson: ScheduleLesson,
  context: ScheduleContext,
  options: SchedulePresentationOptions = {},
): ScheduleLessonView {
  return {
    id: lesson.id,
    href: scheduleLessonHref(lesson.id, context),
    title: lesson.effective.discipline.name,
    typeLabel: getLessonTypeLabel(lesson.type),
    subgroupLabel: lesson.subgroup === "ALL" ? null : getLessonSubgroupLabel(lesson.subgroup),
    timeLabel: formatScheduleTimeRange(lesson.effective.startsAt, lesson.effective.endsAt),
    startsAt: lesson.effective.startsAt.getTime(),
    endsAt: lesson.effective.endsAt.getTime(),
    startsAtIso: lesson.effective.startsAt.toISOString(),
    endsAtIso: lesson.effective.endsAt.toISOString(),
    teacher: options.compact
      ? formatScheduleTeacherCompact(lesson.effective.teacher.fullName)
      : lesson.effective.teacher.fullName,
    room: options.compact
      ? formatScheduleRoomCompact(lesson.effective.room)
      : formatScheduleRoom(lesson.effective.room),
    cancelled: lesson.effective.status === "CANCELLED",
    changes: scheduleChangeViews(lesson, options),
  };
}
