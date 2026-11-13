import "dotenv/config";

import { createAuth } from "../src/lib/auth/create-auth";
import { createPrismaClient } from "../src/lib/db/client";

const prisma = createPrismaClient();
const auth = createAuth(prisma);

/** Пароль демо-аккаунтов для жюри; в БД хранится только scrypt-хеш Better Auth. */
const DEMO_PASSWORD = "Deanery#2026";

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
  enrolledAt: Date;
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
    enrolledAt: new Date("2025-09-01T00:00:00.000Z"),
  },
];

type SeedSummary = {
  created: number;
  updated: number;
  profiles: number;
};

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

async function main() {
  const summary: SeedSummary = { created: 0, updated: 0, profiles: 0 };

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
        enrolledAt: student.enrolledAt,
      },
    });
    summary.profiles += 1;
  }

  console.log(
    `Seed завершён: пользователей создано ${summary.created}, обновлено ${summary.updated}, профилей обработано ${summary.profiles}.`,
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
