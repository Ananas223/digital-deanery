import "dotenv/config";

import { createAuth } from "../src/lib/auth/create-auth";
import { createPrismaClient } from "../src/lib/db/client";

const prisma = createPrismaClient();
const auth = createAuth(prisma);

/** Пароль демо-аккаунтов для жюри; в БД хранится только scrypt-хеш Better Auth. */
const DEMO_PASSWORD = "Deanery#2026";

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type LessonTypeValue = "LECTURE" | "PRACTICE" | "LABORATORY" | "SEMINAR";
type SubgroupValue = "ALL" | "FIRST" | "SECOND";
type ChangeTypeValue =
  "CANCELLATION" | "TIME_CHANGE" | "ROOM_CHANGE" | "TEACHER_CHANGE" | "LESSON_REPLACEMENT";

type DemoStudent = {
  email: string;
  name: string;
  role: "STUDENT";
  studentNumber: string;
  facultyCode: string;
  programCode: string;
  groupCode: string;
  course: number;
  studyForm: "BUDGET" | "PAID";
  subgroup: "FIRST" | "SECOND";
  enrolledAt: Date;
};

type DemoTeacher = {
  email: string;
  fullName: string;
};

type DemoDiscipline = {
  code: string;
  name: string;
  teacherEmail: string;
};

type DemoRoom = {
  number: string;
  name?: string;
  capacity?: number;
};

type DemoBuilding = {
  code: string;
  name: string;
  address: string;
  rooms: DemoRoom[];
};

type DemoLesson = {
  day: number;
  start: [number, number];
  end: [number, number];
  disciplineCode: string;
  type: LessonTypeValue;
  subgroup?: SubgroupValue;
  buildingCode: string;
  roomNumber: string;
  teacherEmail?: string;
};

type DemoChange = {
  groupCode: string;
  day: number;
  start: [number, number];
  disciplineCode: string;
  subgroup?: SubgroupValue;
  type: ChangeTypeValue;
  reason: string;
  newStart?: [number, number];
  newEnd?: [number, number];
  newBuildingCode?: string;
  newRoomNumber?: string;
  newTeacherEmail?: string;
  replacementDisciplineCode?: string;
};

const FACULTIES = [
  { code: "FMO", name: "Факультет международных отношений" },
  { code: "FMEO", name: "Факультет международных экономических отношений" },
] as const;

const PROGRAMS = [
  { code: "MO", name: "Международные отношения", facultyCode: "FMO" },
  { code: "MEO", name: "Мировая экономика", facultyCode: "FMEO" },
] as const;

const GROUPS = [
  { code: "MO-21-4", programCode: "MO" },
  { code: "MEO-11-2", programCode: "MEO" },
] as const;

const DEMO_STUDENTS: DemoStudent[] = [
  {
    email: "anna.petrova@example.com",
    name: "Анна Петрова",
    role: "STUDENT",
    studentNumber: "MO-21-0047",
    facultyCode: "FMO",
    programCode: "MO",
    groupCode: "MO-21-4",
    course: 2,
    studyForm: "BUDGET",
    subgroup: "FIRST",
    enrolledAt: new Date("2024-09-01T00:00:00.000Z"),
  },
  {
    email: "mark.sokolov@example.com",
    name: "Марк Соколов",
    role: "STUDENT",
    studentNumber: "MEO-11-0112",
    facultyCode: "FMEO",
    programCode: "MEO",
    groupCode: "MEO-11-2",
    course: 1,
    studyForm: "PAID",
    subgroup: "SECOND",
    enrolledAt: new Date("2025-09-01T00:00:00.000Z"),
  },
];

const TEACHERS: DemoTeacher[] = [
  { email: "i.sokolova@example.com", fullName: "Ирина Владимировна Соколова" },
  { email: "d.lebedev@example.com", fullName: "Дмитрий Андреевич Лебедев" },
  { email: "m.orlova@example.com", fullName: "Мария Сергеевна Орлова" },
  { email: "a.krylov@example.com", fullName: "Алексей Николаевич Крылов" },
  { email: "e.zakharova@example.com", fullName: "Елена Павловна Захарова" },
  { email: "p.melnikov@example.com", fullName: "Павел Игоревич Мельников" },
  { email: "n.belova@example.com", fullName: "Наталья Олеговна Белова" },
];

const DISCIPLINES: DemoDiscipline[] = [
  {
    code: "MO-101",
    name: "История международных отношений",
    teacherEmail: "i.sokolova@example.com",
  },
  {
    code: "MO-102",
    name: "Теория международных отношений",
    teacherEmail: "d.lebedev@example.com",
  },
  {
    code: "MO-103",
    name: "Иностранный язык (английский)",
    teacherEmail: "m.orlova@example.com",
  },
  {
    code: "MO-104",
    name: "Международное право",
    teacherEmail: "a.krylov@example.com",
  },
  {
    code: "MO-105",
    name: "Экономическая география",
    teacherEmail: "e.zakharova@example.com",
  },
  {
    code: "MEO-101",
    name: "Микроэкономика",
    teacherEmail: "p.melnikov@example.com",
  },
  {
    code: "MEO-102",
    name: "Бухгалтерский учёт",
    teacherEmail: "e.zakharova@example.com",
  },
  {
    code: "MEO-103",
    name: "Иностранный язык (английский)",
    teacherEmail: "m.orlova@example.com",
  },
  {
    code: "MEO-104",
    name: "Статистика",
    teacherEmail: "d.lebedev@example.com",
  },
  {
    code: "MEO-105",
    name: "Основы предпринимательства",
    teacherEmail: "i.sokolova@example.com",
  },
];

const BUILDINGS: DemoBuilding[] = [
  {
    code: "A",
    name: "Корпус А",
    address: "ул. Университетская, 1",
    rooms: [
      { number: "101", name: "Аудитория 101", capacity: 30 },
      { number: "203", name: "Аудитория 203", capacity: 28 },
      { number: "305", name: "Аудитория 305", capacity: 24 },
      { number: "410", name: "Аудитория 410", capacity: 20 },
    ],
  },
  {
    code: "B",
    name: "Корпус Б",
    address: "ул. Студенческая, 7",
    rooms: [
      { number: "12", name: "Лингафонный кабинет", capacity: 16 },
      { number: "24", name: "Аудитория 24", capacity: 18 },
    ],
  },
];

const SCHEDULE: Record<string, DemoLesson[]> = {
  "MO-21-4": [
    {
      day: 0,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-101",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 0,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-102",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 0,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 0,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "SECOND",
      buildingCode: "B",
      roomNumber: "24",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 1,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-104",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 1,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-105",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 1,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 1,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "SECOND",
      buildingCode: "B",
      roomNumber: "24",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 2,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-101",
      type: "SEMINAR",
      buildingCode: "A",
      roomNumber: "410",
    },
    {
      day: 2,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-102",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "410",
    },
    {
      day: 3,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-105",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 3,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-104",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 4,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-102",
      type: "SEMINAR",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 4,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-101",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 4,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "LABORATORY",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 4,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "LABORATORY",
      subgroup: "SECOND",
      buildingCode: "B",
      roomNumber: "24",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 5,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-105",
      type: "SEMINAR",
      buildingCode: "A",
      roomNumber: "203",
    },
  ],
  "MEO-11-2": [
    {
      day: 0,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MEO-101",
      type: "LECTURE",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 0,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-102",
      type: "PRACTICE",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 1,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-103",
      type: "PRACTICE",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 1,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-103",
      type: "PRACTICE",
      subgroup: "SECOND",
      buildingCode: "A",
      roomNumber: "203",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 1,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MEO-104",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 2,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MEO-105",
      type: "SEMINAR",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 2,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-101",
      type: "PRACTICE",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 3,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-102",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 3,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MEO-103",
      type: "LABORATORY",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 3,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MEO-103",
      type: "LABORATORY",
      subgroup: "SECOND",
      buildingCode: "A",
      roomNumber: "203",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 4,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MEO-104",
      type: "PRACTICE",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 4,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-105",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "305",
    },
  ],
};

const CHANGES: DemoChange[] = [
  {
    groupCode: "MO-21-4",
    day: 0,
    start: [9, 0],
    disciplineCode: "MO-101",
    type: "CANCELLATION",
    reason: "Преподаватель на научной конференции",
  },
  {
    groupCode: "MO-21-4",
    day: 1,
    start: [10, 45],
    disciplineCode: "MO-105",
    type: "TIME_CHANGE",
    reason: "Перенос после заседания кафедры",
    newStart: [12, 30],
    newEnd: [14, 0],
  },
  {
    groupCode: "MO-21-4",
    day: 2,
    start: [13, 0],
    disciplineCode: "MO-102",
    type: "ROOM_CHANGE",
    reason: "В аудитории 410 проходит олимпиада",
    newBuildingCode: "A",
    newRoomNumber: "203",
  },
  {
    groupCode: "MO-21-4",
    day: 3,
    start: [10, 45],
    disciplineCode: "MO-104",
    type: "TEACHER_CHANGE",
    reason: "Замена преподавателя по болезни",
    newTeacherEmail: "d.lebedev@example.com",
  },
  {
    groupCode: "MO-21-4",
    day: 4,
    start: [9, 0],
    disciplineCode: "MO-102",
    type: "LESSON_REPLACEMENT",
    reason: "Занятие заменено по распоряжению деканата",
    replacementDisciplineCode: "MO-105",
  },
  {
    groupCode: "MEO-11-2",
    day: 0,
    start: [9, 0],
    disciplineCode: "MEO-101",
    type: "CANCELLATION",
    reason: "Преподаватель на больничном",
  },
  {
    groupCode: "MEO-11-2",
    day: 2,
    start: [9, 0],
    disciplineCode: "MEO-105",
    type: "ROOM_CHANGE",
    reason: "Аудитория 24 занята",
    newBuildingCode: "A",
    newRoomNumber: "305",
  },
  {
    groupCode: "MEO-11-2",
    day: 3,
    start: [10, 45],
    disciplineCode: "MEO-102",
    type: "TIME_CHANGE",
    reason: "Сдвиг из-за общего собрания курса",
    newStart: [12, 30],
    newEnd: [14, 0],
  },
  {
    groupCode: "MEO-11-2",
    day: 4,
    start: [9, 0],
    disciplineCode: "MEO-104",
    type: "TEACHER_CHANGE",
    reason: "Замена преподавателя",
    newTeacherEmail: "e.zakharova@example.com",
  },
];

type SeedSummary = {
  created: number;
  updated: number;
  profiles: number;
  lessons: number;
  changes: number;
};

/** Понедельник текущей недели в 00:00 по Москве, выраженный как UTC-инстант. */
function getCurrentWeekMonday(): number {
  const mskNow = new Date(Date.now() + MSK_OFFSET_MS);
  const weekday = mskNow.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  return (
    Date.UTC(mskNow.getUTCFullYear(), mskNow.getUTCMonth(), mskNow.getUTCDate() - daysSinceMonday) -
    MSK_OFFSET_MS
  );
}

function atMoscowTime(weekStart: number, day: number, [hour, minute]: [number, number]): Date {
  return new Date(weekStart + day * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS);
}

function lessonKey(
  groupCode: string,
  day: number,
  start: [number, number],
  disciplineCode: string,
  subgroup: SubgroupValue,
): string {
  return [groupCode, day, start.join(":"), disciplineCode, subgroup].join("|");
}

async function ensureDemoStudent(student: DemoStudent, summary: SeedSummary) {
  const existing = await prisma.user.findUnique({
    where: { email: student.email },
    select: { id: true },
  });

  let userId: string;

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: student.name, role: student.role },
      select: { id: true },
    });
    userId = user.id;
    summary.updated += 1;
  } else {
    const result = await auth.api.signUpEmail({
      body: {
        email: student.email,
        password: DEMO_PASSWORD,
        name: student.name,
      },
    });

    if (!result.user?.id) {
      throw new Error(`Не удалось создать демо-пользователя ${student.email}`);
    }

    const user = await prisma.user.update({
      where: { id: result.user.id },
      data: { name: student.name, role: student.role },
      select: { id: true },
    });
    userId = user.id;
    summary.created += 1;
  }

  return userId;
}

async function seedSchedule(
  groups: Map<string, string>,
  teachers: Map<string, string>,
  disciplines: Map<string, string>,
  rooms: Map<string, string>,
  summary: SeedSummary,
) {
  const groupIds = [...groups.values()];

  // Seed владеет демонстрационным расписанием: перед пересозданием удаляем
  // прошлые занятия этих групп. Изменения удаляются каскадом.
  await prisma.lesson.deleteMany({ where: { groupId: { in: groupIds } } });

  const weekStart = getCurrentWeekMonday();
  const lessonIds = new Map<string, string>();

  for (const [groupCode, lessons] of Object.entries(SCHEDULE)) {
    const groupId = groups.get(groupCode);
    if (!groupId) {
      throw new Error(`Не найдена группа ${groupCode}`);
    }

    for (const lesson of lessons) {
      const disciplineId = disciplines.get(lesson.disciplineCode);
      if (!disciplineId) {
        throw new Error(`Не найдена дисциплина ${lesson.disciplineCode}`);
      }

      const subgroup = lesson.subgroup ?? "ALL";
      const teacherId = lesson.teacherEmail
        ? teachers.get(lesson.teacherEmail)
        : teachers.get(
            DISCIPLINES.find((item) => item.code === lesson.disciplineCode)?.teacherEmail ?? "",
          );

      if (!teacherId) {
        throw new Error(`Не найден преподаватель для ${lesson.disciplineCode}`);
      }

      const roomId = rooms.get(`${lesson.buildingCode}:${lesson.roomNumber}`);
      if (!roomId) {
        throw new Error(`Не найдена аудитория ${lesson.buildingCode}-${lesson.roomNumber}`);
      }

      const created = await prisma.lesson.create({
        data: {
          groupId,
          disciplineId,
          teacherId,
          roomId,
          type: lesson.type,
          subgroup,
          startsAt: atMoscowTime(weekStart, lesson.day, lesson.start),
          endsAt: atMoscowTime(weekStart, lesson.day, lesson.end),
        },
        select: { id: true },
      });

      lessonIds.set(
        lessonKey(groupCode, lesson.day, lesson.start, lesson.disciplineCode, subgroup),
        created.id,
      );
      summary.lessons += 1;
    }
  }

  for (const change of CHANGES) {
    const subgroup = change.subgroup ?? "ALL";
    const lessonId = lessonIds.get(
      lessonKey(change.groupCode, change.day, change.start, change.disciplineCode, subgroup),
    );

    if (!lessonId) {
      throw new Error(
        `Не найдено занятие для изменения: ${change.groupCode} ${change.disciplineCode}`,
      );
    }

    const newRoomId =
      change.newBuildingCode && change.newRoomNumber
        ? rooms.get(`${change.newBuildingCode}:${change.newRoomNumber}`)
        : undefined;

    if (change.newBuildingCode && !newRoomId) {
      throw new Error(`Не найдена аудитория ${change.newBuildingCode}-${change.newRoomNumber}`);
    }

    const newTeacherId = change.newTeacherEmail ? teachers.get(change.newTeacherEmail) : undefined;

    if (change.newTeacherEmail && !newTeacherId) {
      throw new Error(`Не найден преподаватель ${change.newTeacherEmail}`);
    }

    const replacementDisciplineId = change.replacementDisciplineCode
      ? disciplines.get(change.replacementDisciplineCode)
      : undefined;

    if (change.replacementDisciplineCode && !replacementDisciplineId) {
      throw new Error(`Не найдена дисциплина ${change.replacementDisciplineCode}`);
    }

    await prisma.lessonChange.create({
      data: {
        lessonId,
        type: change.type,
        reason: change.reason,
        ...(change.newStart && change.newEnd
          ? {
              newStartsAt: atMoscowTime(weekStart, change.day, change.newStart),
              newEndsAt: atMoscowTime(weekStart, change.day, change.newEnd),
            }
          : {}),
        ...(newRoomId ? { newRoomId } : {}),
        ...(newTeacherId ? { newTeacherId } : {}),
        ...(replacementDisciplineId ? { replacementDisciplineId } : {}),
      },
    });
    summary.changes += 1;
  }
}

async function main() {
  const summary: SeedSummary = {
    created: 0,
    updated: 0,
    profiles: 0,
    lessons: 0,
    changes: 0,
  };

  const faculties = new Map<string, string>();
  for (const faculty of FACULTIES) {
    const record = await prisma.faculty.upsert({
      where: { code: faculty.code },
      update: { name: faculty.name },
      create: { code: faculty.code, name: faculty.name },
      select: { id: true, code: true },
    });
    faculties.set(record.code, record.id);
  }

  const programs = new Map<string, string>();
  for (const program of PROGRAMS) {
    const facultyId = faculties.get(program.facultyCode);
    if (!facultyId) {
      throw new Error(`Не найден факультет ${program.facultyCode}`);
    }

    const record = await prisma.program.upsert({
      where: { code: program.code },
      update: { name: program.name, facultyId },
      create: { code: program.code, name: program.name, facultyId },
      select: { id: true, code: true },
    });
    programs.set(record.code, record.id);
  }

  const groups = new Map<string, string>();
  for (const group of GROUPS) {
    const programId = programs.get(group.programCode);
    if (!programId) {
      throw new Error(`Не найдено направление ${group.programCode}`);
    }

    const record = await prisma.group.upsert({
      where: { code: group.code },
      update: { programId },
      create: { code: group.code, programId },
      select: { id: true, code: true },
    });
    groups.set(record.code, record.id);
  }

  for (const student of DEMO_STUDENTS) {
    const facultyId = faculties.get(student.facultyCode);
    const programId = programs.get(student.programCode);
    const groupId = groups.get(student.groupCode);

    if (!facultyId || !programId || !groupId) {
      throw new Error(`Неполные справочники для ${student.email}`);
    }

    const userId = await ensureDemoStudent(student, summary);

    await prisma.studentProfile.upsert({
      where: { userId },
      update: {
        studentNumber: student.studentNumber,
        facultyId,
        programId,
        groupId,
        course: student.course,
        studyForm: student.studyForm,
        subgroup: student.subgroup,
        enrolledAt: student.enrolledAt,
      },
      create: {
        userId,
        studentNumber: student.studentNumber,
        facultyId,
        programId,
        groupId,
        course: student.course,
        studyForm: student.studyForm,
        subgroup: student.subgroup,
        enrolledAt: student.enrolledAt,
      },
    });
    summary.profiles += 1;
  }

  const teachers = new Map<string, string>();
  for (const teacher of TEACHERS) {
    const record = await prisma.teacher.upsert({
      where: { email: teacher.email },
      update: { fullName: teacher.fullName },
      create: { email: teacher.email, fullName: teacher.fullName },
      select: { id: true, email: true },
    });
    if (record.email) {
      teachers.set(record.email, record.id);
    }
  }

  const disciplines = new Map<string, string>();
  for (const discipline of DISCIPLINES) {
    const teacherId = teachers.get(discipline.teacherEmail);
    if (!teacherId) {
      throw new Error(`Не найден преподаватель ${discipline.teacherEmail}`);
    }

    const record = await prisma.discipline.upsert({
      where: { code: discipline.code },
      update: { name: discipline.name, teacherId },
      create: { code: discipline.code, name: discipline.name, teacherId },
      select: { id: true, code: true },
    });
    disciplines.set(record.code, record.id);
  }

  const rooms = new Map<string, string>();
  for (const building of BUILDINGS) {
    const buildingRecord = await prisma.building.upsert({
      where: { code: building.code },
      update: { name: building.name, address: building.address },
      create: { code: building.code, name: building.name, address: building.address },
      select: { id: true, code: true },
    });

    for (const room of building.rooms) {
      const roomRecord = await prisma.room.upsert({
        where: {
          buildingId_number: {
            buildingId: buildingRecord.id,
            number: room.number,
          },
        },
        update: { name: room.name, capacity: room.capacity },
        create: {
          buildingId: buildingRecord.id,
          number: room.number,
          name: room.name,
          capacity: room.capacity,
        },
        select: { id: true },
      });
      rooms.set(`${buildingRecord.code}:${room.number}`, roomRecord.id);
    }
  }

  await seedSchedule(groups, teachers, disciplines, rooms, summary);

  console.log(
    `Seed завершён: пользователей создано ${summary.created}, обновлено ${summary.updated}, профилей обработано ${summary.profiles}, занятий создано ${summary.lessons}, изменений ${summary.changes}.`,
  );
}

main()
  .catch((error: unknown) => {
    // Не печатаем объект ошибки целиком: в нём могут быть входные данные.
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    console.error(`Seed завершился с ошибкой: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
