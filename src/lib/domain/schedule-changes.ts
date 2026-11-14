import type { LessonChangeType } from "@/generated/prisma/enums";

export type ScheduleDiscipline = { id: string; code: string; name: string };

export type ScheduleTeacher = { id: string; fullName: string };

export type ScheduleRoom = {
  id: string;
  number: string;
  name: string | null;
  building: { id: string; code: string; name: string };
};

export type LessonSnapshot = {
  startsAt: Date;
  endsAt: Date;
  discipline: ScheduleDiscipline;
  teacher: ScheduleTeacher;
  room: ScheduleRoom;
};

export type LessonChangeInput = {
  id: string;
  type: LessonChangeType;
  reason: string | null;
  createdAt: Date;
  newStartsAt: Date | null;
  newEndsAt: Date | null;
  newRoom: ScheduleRoom | null;
  newTeacher: ScheduleTeacher | null;
  replacementDiscipline: ScheduleDiscipline | null;
};

export type ResolvedLessonState = LessonSnapshot & {
  status: "SCHEDULED" | "CANCELLED";
};

export const LESSON_CHANGE_LABELS: Record<LessonChangeType, string> = {
  CANCELLATION: "Отмена",
  TIME_CHANGE: "Перенос времени",
  ROOM_CHANGE: "Смена аудитории",
  TEACHER_CHANGE: "Замена преподавателя",
  LESSON_REPLACEMENT: "Замена занятия",
};

/** Возвращает человекочитаемое название типа изменения занятия. */
export function getLessonChangeLabel(type: LessonChangeType): string {
  return LESSON_CHANGE_LABELS[type];
}

/**
 * Сортирует изменения по времени создания, при совпадении — по идентификатору.
 * Возвращает новый массив, не мутируя исходный.
 */
export function sortLessonChanges<T extends { id: string; createdAt: Date }>(
  changes: readonly T[],
): T[] {
  return [...changes].sort((a, b) => {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) {
      return byTime;
    }

    return a.id.localeCompare(b.id);
  });
}

/**
 * Вычисляет фактическое состояние занятия, накладывая изменения на исходный
 * снимок. Изменения применяются в порядке `sortLessonChanges`: более позднее
 * изменение того же аспекта побеждает. Отмена терминальна — последующие
 * изменения не восстанавливают занятие. Исходные данные не мутируются.
 */
export function resolveLessonState(
  original: LessonSnapshot,
  changes: readonly LessonChangeInput[],
): ResolvedLessonState {
  let effective: ResolvedLessonState = {
    ...original,
    status: "SCHEDULED",
  };

  for (const change of sortLessonChanges(changes)) {
    switch (change.type) {
      case "CANCELLATION":
        effective = { ...effective, status: "CANCELLED" };
        break;
      case "TIME_CHANGE":
        if (change.newStartsAt !== null && change.newEndsAt !== null) {
          effective = {
            ...effective,
            startsAt: change.newStartsAt,
            endsAt: change.newEndsAt,
          };
        }
        break;
      case "ROOM_CHANGE":
        if (change.newRoom !== null) {
          effective = { ...effective, room: change.newRoom };
        }
        break;
      case "TEACHER_CHANGE":
        if (change.newTeacher !== null) {
          effective = { ...effective, teacher: change.newTeacher };
        }
        break;
      case "LESSON_REPLACEMENT":
        if (change.replacementDiscipline !== null) {
          effective = {
            ...effective,
            discipline: change.replacementDiscipline,
          };
        }
        break;
    }
  }

  return effective;
}
