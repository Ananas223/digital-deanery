import "server-only";

import type { LessonSubgroup, LessonType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import {
  getLessonChangeLabel,
  resolveLessonState,
  sortLessonChanges,
  type LessonChangeInput,
  type LessonSnapshot,
  type ResolvedLessonState,
  type ScheduleDiscipline,
  type ScheduleRoom,
  type ScheduleTeacher,
} from "./schedule-changes";

export type {
  LessonChangeInput,
  LessonSnapshot,
  ResolvedLessonState,
  ScheduleDiscipline,
  ScheduleRoom,
  ScheduleTeacher,
};
export { getLessonChangeLabel };

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  LECTURE: "Лекция",
  PRACTICE: "Практика",
  LABORATORY: "Лабораторная",
  SEMINAR: "Семинар",
};

/** Возвращает человекочитаемое название типа занятия. */
export function getLessonTypeLabel(type: LessonType): string {
  return LESSON_TYPE_LABELS[type];
}

export const LESSON_SUBGROUP_LABELS: Record<LessonSubgroup, string> = {
  ALL: "Вся группа",
  FIRST: "Первая подгруппа",
  SECOND: "Вторая подгруппа",
};

/** Возвращает человекочитаемое название подгруппы занятия. */
export function getLessonSubgroupLabel(subgroup: LessonSubgroup): string {
  return LESSON_SUBGROUP_LABELS[subgroup];
}

export type LessonCard = {
  id: string;
  groupCode: string;
  type: LessonType;
  subgroup: LessonSubgroup;
  original: LessonSnapshot;
  changes: LessonChangeInput[];
  effective: ResolvedLessonState;
};

const roomSelect = {
  id: true,
  number: true,
  name: true,
  building: { select: { id: true, code: true, name: true } },
} as const;

/**
 * Читает карточку занятия для текущего студента.
 *
 * `userId` берётся только из проверенной серверной сессии: клиентский
 * идентификатор сюда не передаётся. Возвращает `null`, если профиль не найден,
 * занятие отсутствует, относится к другой группе или недоступной подгруппе —
 * так чужие и несуществующие ресурсы не различаются.
 *
 * Фактическое состояние (`effective`) накладывает изменения на неизменный
 * исходный снимок (`original`), который сохраняется для отображения в карточке.
 */
export async function getLessonCard(
  userId: string,
  lessonId: string,
): Promise<LessonCard | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { groupId: true, subgroup: true },
  });

  if (!profile) {
    return null;
  }

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      groupId: profile.groupId,
      OR: [{ subgroup: "ALL" }, { subgroup: profile.subgroup }],
    },
    select: {
      id: true,
      type: true,
      subgroup: true,
      startsAt: true,
      endsAt: true,
      group: { select: { code: true } },
      discipline: { select: { id: true, code: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
      room: { select: roomSelect },
      changes: {
        select: {
          id: true,
          type: true,
          reason: true,
          createdAt: true,
          newStartsAt: true,
          newEndsAt: true,
          newRoom: { select: roomSelect },
          newTeacher: { select: { id: true, fullName: true } },
          replacementDiscipline: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  });

  if (!lesson) {
    return null;
  }

  const original: LessonSnapshot = {
    startsAt: lesson.startsAt,
    endsAt: lesson.endsAt,
    discipline: lesson.discipline,
    teacher: lesson.teacher,
    room: lesson.room,
  };

  const changes = sortLessonChanges(lesson.changes);

  return {
    id: lesson.id,
    groupCode: lesson.group.code,
    type: lesson.type,
    subgroup: lesson.subgroup,
    original,
    changes,
    effective: resolveLessonState(original, changes),
  };
}
