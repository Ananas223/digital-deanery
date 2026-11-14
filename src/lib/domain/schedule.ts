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
import {
  addMoscowDays,
  getMoscowDateKey,
  getStudyWeekNumber,
  startOfMoscowDay,
  startOfMoscowWeek,
} from "./schedule-time";

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

/** Одно занятие в списке расписания: та же форма, что и в карточке занятия. */
export type ScheduleLesson = LessonCard;

export type ScheduleDay = {
  /** Московская дата в формате `ГГГГ-ММ-ДД`. */
  date: string;
  /** Начало дня: 00:00 по Москве как UTC-инстант. */
  startsAt: Date;
  /** Занятия по возрастанию фактического времени начала. */
  lessons: ScheduleLesson[];
};

export type ScheduleWeek = {
  /** Московская дата понедельника в формате `ГГГГ-ММ-ДД`. */
  weekStart: string;
  /** Номер учебной недели. */
  weekNumber: number;
  /** Семь дней с понедельника по воскресенье, включая пустые. */
  days: ScheduleDay[];
};

const roomSelect = {
  id: true,
  number: true,
  name: true,
  building: { select: { id: true, code: true, name: true } },
} as const;

const lessonSelect = {
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
} as const;

type LessonRow = {
  id: string;
  type: LessonType;
  subgroup: LessonSubgroup;
  startsAt: Date;
  endsAt: Date;
  group: { code: string };
  discipline: ScheduleDiscipline;
  teacher: ScheduleTeacher;
  room: ScheduleRoom;
  changes: readonly LessonChangeInput[];
};

function toScheduleLesson(lesson: LessonRow): ScheduleLesson {
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

/** Группа и подгруппа студента — единственный источник доступа к расписанию. */
async function getScheduleContext(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { groupId: true, subgroup: true },
  });
}

type ScheduleContext = NonNullable<Awaited<ReturnType<typeof getScheduleContext>>>;

/**
 * Читает занятия группы за интервал `[from, to)` с занятиями доступных подгрупп.
 *
 * Занятие может быть перенесено на другой день, поэтому выборка учитывает и
 * исходное время, и время из переносов. После наложения всех изменений список
 * фильтруется по фактическому началу: занятие, уехавшее за границы интервала,
 * в него не попадает, а приехавшее — попадает.
 */
async function loadScheduleLessons(
  context: ScheduleContext,
  from: Date,
  to: Date,
): Promise<ScheduleLesson[]> {
  const lessons = await prisma.lesson.findMany({
    where: {
      groupId: context.groupId,
      OR: [{ subgroup: "ALL" }, { subgroup: context.subgroup }],
      AND: [
        {
          OR: [
            { startsAt: { gte: from, lt: to } },
            { changes: { some: { newStartsAt: { gte: from, lt: to } } } },
          ],
        },
      ],
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: lessonSelect,
  });

  return lessons
    .map(toScheduleLesson)
    .filter((lesson) => {
      const startsAt = lesson.effective.startsAt.getTime();
      return startsAt >= from.getTime() && startsAt < to.getTime();
    })
    .sort(
      (a, b) =>
        a.effective.startsAt.getTime() - b.effective.startsAt.getTime() || a.id.localeCompare(b.id),
    );
}

function buildScheduleDay(dayStart: Date, lessons: readonly ScheduleLesson[]): ScheduleDay {
  const dayEnd = addMoscowDays(dayStart, 1);

  return {
    date: getMoscowDateKey(dayStart),
    startsAt: dayStart,
    lessons: lessons.filter((lesson) => {
      const startsAt = lesson.effective.startsAt.getTime();
      return startsAt >= dayStart.getTime() && startsAt < dayEnd.getTime();
    }),
  };
}

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
export async function getLessonCard(userId: string, lessonId: string): Promise<LessonCard | null> {
  const context = await getScheduleContext(userId);

  if (!context) {
    return null;
  }

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      groupId: context.groupId,
      OR: [{ subgroup: "ALL" }, { subgroup: context.subgroup }],
    },
    select: lessonSelect,
  });

  return lesson ? toScheduleLesson(lesson) : null;
}

/**
 * Расписание текущего студента на московский день `now` (по умолчанию сегодня).
 *
 * Возвращает `null`, если у пользователя нет академического профиля: страница
 * покажет нейтральное пояснение, а не пустое расписание. Пустой день — это
 * день с пустым `lessons`, а не ошибка (`Ф-02.6`).
 */
export async function getTodaySchedule(
  userId: string,
  now: Date = new Date(),
): Promise<ScheduleDay | null> {
  const context = await getScheduleContext(userId);

  if (!context) {
    return null;
  }

  const dayStart = startOfMoscowDay(now);
  const lessons = await loadScheduleLessons(context, dayStart, addMoscowDays(dayStart, 1));

  return buildScheduleDay(dayStart, lessons);
}

/**
 * Расписание текущего студента на неделю, содержащую `weekOf` (по умолчанию
 * текущую). Неделя начинается в понедельник 00:00 по Москве и всегда содержит
 * семь дней, включая пустые. Номер недели считается от начала учебного года.
 *
 * Как и в `getTodaySchedule`, `userId` приходит только из серверной сессии.
 */
export async function getWeekSchedule(
  userId: string,
  weekOf: Date = new Date(),
): Promise<ScheduleWeek | null> {
  const context = await getScheduleContext(userId);

  if (!context) {
    return null;
  }

  const weekStart = startOfMoscowWeek(weekOf);
  const lessons = await loadScheduleLessons(context, weekStart, addMoscowDays(weekStart, 7));

  const days = Array.from({ length: 7 }, (_, index) =>
    buildScheduleDay(addMoscowDays(weekStart, index), lessons),
  );

  return {
    weekStart: getMoscowDateKey(weekStart),
    weekNumber: getStudyWeekNumber(weekStart),
    days,
  };
}
