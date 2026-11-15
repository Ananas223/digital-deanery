import "server-only";

import type { AssessmentType, GradeStatus, SemesterTerm } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export type { AssessmentType, GradeStatus, SemesterTerm };

export type Semester = {
  id: string;
  academicYear: string;
  term: SemesterTerm;
  startsAt: Date;
  endsAt: Date;
  /** Семестр включает `now`: сравнение по датам, без отдельного флага в БД. */
  isCurrent: boolean;
};

export type GradeEntry = {
  id: string;
  discipline: { id: string; code: string; name: string };
  teacherName: string | null;
  assessmentType: AssessmentType;
  credits: number;
  score: number | null;
  status: GradeStatus;
};

export type SessionExam = {
  id: string;
  discipline: { id: string; code: string; name: string };
  assessmentType: AssessmentType;
  startsAt: Date;
  endsAt: Date;
  room: { buildingCode: string; number: string; name: string | null } | null;
  teacherName: string | null;
  /** Результат из `Grade` по той же дисциплине; `null`, если он ещё не внесён. */
  result: { score: number | null; status: GradeStatus } | null;
};

export type SemesterOverview = {
  semester: Semester;
  /** Дисциплины семестра по названию; пустой список — нет данных (`Ф-03.8`). */
  grades: GradeEntry[];
  /** Экзамены и зачёты группы по времени начала (`US-05`). */
  session: SessionExam[];
};

export const SEMESTER_TERM_LABELS: Record<SemesterTerm, string> = {
  AUTUMN: "Осенний семестр",
  SPRING: "Весенний семестр",
};

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  EXAM: "Экзамен",
  CREDIT: "Зачёт",
  GRADED_CREDIT: "Дифференцированный зачёт",
  COURSEWORK: "Курсовая работа",
};

export const GRADE_STATUS_LABELS: Record<GradeStatus, string> = {
  PASSED: "Зачёт",
  FAILED: "Незачёт",
  NOT_GRADED: "Не выставлено",
};

/** Название семестра для переключателя и заголовка. */
export function getSemesterLabel(semester: Pick<Semester, "term" | "academicYear">): string {
  return `${SEMESTER_TERM_LABELS[semester.term]} ${semester.academicYear}`;
}

export function getAssessmentTypeLabel(type: AssessmentType): string {
  return ASSESSMENT_TYPE_LABELS[type];
}

export function getGradeStatusLabel(status: GradeStatus): string {
  return GRADE_STATUS_LABELS[status];
}

const semesterSelect = {
  id: true,
  academicYear: true,
  term: true,
  startsAt: true,
  endsAt: true,
} as const;

type SemesterRow = {
  id: string;
  academicYear: string;
  term: SemesterTerm;
  startsAt: Date;
  endsAt: Date;
};

function isWithin(semester: SemesterRow, now: Date): boolean {
  const time = now.getTime();
  return semester.startsAt.getTime() <= time && time <= semester.endsAt.getTime();
}

function toSemester(semester: SemesterRow, now: Date): Semester {
  return { ...semester, isCurrent: isWithin(semester, now) };
}

/** Профиль студента — единственный источник доступа к его успеваемости. */
async function getGradesContext(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true, groupId: true },
  });
}

/**
 * Семестры для переключателя: от нового к старому.
 *
 * `userId` берётся только из проверенной серверной сессии. Если профиля нет,
 * возвращается пустой список: страница покажет нейтральное пояснение.
 */
export async function getSemesters(userId: string, now: Date = new Date()): Promise<Semester[]> {
  const context = await getGradesContext(userId);

  if (!context) {
    return [];
  }

  const semesters = await prisma.semester.findMany({
    orderBy: [{ startsAt: "desc" }, { id: "asc" }],
    select: semesterSelect,
  });

  return semesters.map((semester) => toSemester(semester, now));
}

/**
 * Успеваемость текущего студента за семестр.
 *
 * Без `semesterId` выбирается текущий семестр по датам, а если такого нет —
 * последний по времени начала. Оценки и экзамены фильтруются по профилю и
 * группе из серверной сессии, поэтому чужой `semesterId` не раскрывает данные
 * другого студента: вернётся пустой семестр. Несуществующий семестр — `null`.
 */
export async function getSemesterOverview(
  userId: string,
  semesterId?: string,
  now: Date = new Date(),
): Promise<SemesterOverview | null> {
  const context = await getGradesContext(userId);

  if (!context) {
    return null;
  }

  const semester = semesterId
    ? await prisma.semester.findUnique({ where: { id: semesterId }, select: semesterSelect })
    : ((await prisma.semester.findFirst({
        where: { startsAt: { lte: now }, endsAt: { gte: now } },
        orderBy: { startsAt: "desc" },
        select: semesterSelect,
      })) ??
      (await prisma.semester.findFirst({
        orderBy: { startsAt: "desc" },
        select: semesterSelect,
      })));

  if (!semester) {
    return null;
  }

  const [grades, exams] = await Promise.all([
    prisma.grade.findMany({
      where: { studentProfileId: context.id, semesterId: semester.id },
      orderBy: [{ discipline: { name: "asc" } }, { id: "asc" }],
      select: {
        id: true,
        assessmentType: true,
        credits: true,
        score: true,
        status: true,
        discipline: {
          select: {
            id: true,
            code: true,
            name: true,
            teacher: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.exam.findMany({
      where: { groupId: context.groupId, semesterId: semester.id },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        assessmentType: true,
        startsAt: true,
        endsAt: true,
        discipline: { select: { id: true, code: true, name: true } },
        room: {
          select: {
            number: true,
            name: true,
            building: { select: { code: true } },
          },
        },
        teacher: { select: { fullName: true } },
      },
    }),
  ]);

  const results = new Map(
    grades.map((grade) => [grade.discipline.id, { score: grade.score, status: grade.status }]),
  );

  return {
    semester: toSemester(semester, now),
    grades: grades.map((grade) => ({
      id: grade.id,
      discipline: grade.discipline,
      teacherName: grade.discipline.teacher?.fullName ?? null,
      assessmentType: grade.assessmentType,
      credits: grade.credits,
      score: grade.score,
      status: grade.status,
    })),
    session: exams.map((exam) => ({
      id: exam.id,
      discipline: exam.discipline,
      assessmentType: exam.assessmentType,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
      room: exam.room
        ? {
            buildingCode: exam.room.building.code,
            number: exam.room.number,
            name: exam.room.name,
          }
        : null,
      teacherName: exam.teacher?.fullName ?? null,
      result: results.get(exam.discipline.id) ?? null,
    })),
  };
}
