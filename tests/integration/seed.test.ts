import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const prisma = createPrismaClient();

/** Демонстрационный пароль из seed; в БД должен храниться только scrypt-хеш. */
const DEMO_PASSWORD = "Deanery#2026";

const EXPECTED_STUDENTS = [
  {
    email: "anna.petrova@example.com",
    name: "Анна Петрова",
    groupCode: "MO-21-4",
    course: 2,
  },
  {
    email: "mark.sokolov@example.com",
    name: "Марк Соколов",
    groupCode: "MEO-11-2",
    course: 1,
  },
] as const;

function runSeed(): void {
  execFileSync(path.resolve(rootDir, "node_modules/.bin/tsx"), ["prisma/seed.ts"], {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: process.env["DATABASE_URL"] },
    stdio: "pipe",
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed тестовой базы", () => {
  it("создаёт ровно двух демо-студентов", async () => {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { email: true, name: true, role: true },
    });

    expect(users).toHaveLength(2);
    expect(users.map((user) => user.email)).toEqual([
      "anna.petrova@example.com",
      "mark.sokolov@example.com",
    ]);
    expect(users.every((user) => user.role === "STUDENT")).toBe(true);
  });

  it("создаёт профили с ожидаемыми группами и курсами", async () => {
    for (const expected of EXPECTED_STUDENTS) {
      const user = await prisma.user.findUnique({
        where: { email: expected.email },
        select: {
          name: true,
          studentProfile: {
            select: {
              course: true,
              group: { select: { code: true } },
              faculty: { select: { code: true } },
              program: { select: { code: true } },
            },
          },
        },
      });

      expect(user?.name).toBe(expected.name);
      expect(user?.studentProfile).not.toBeNull();
      expect(user?.studentProfile?.course).toBe(expected.course);
      expect(user?.studentProfile?.group.code).toBe(expected.groupCode);
      expect(user?.studentProfile?.faculty.code).toBeTruthy();
      expect(user?.studentProfile?.program.code).toBeTruthy();
    }
  });

  it("хранит пароль только как хеш Better Auth", async () => {
    const accounts = await prisma.account.findMany({
      select: { providerId: true, password: true, userId: true },
    });

    expect(accounts).toHaveLength(2);

    for (const account of accounts) {
      expect(account.providerId).toBe("credential");
      expect(account.password).toBeTruthy();
      expect(account.password).not.toBe(DEMO_PASSWORD);
      expect(account.password).not.toContain(DEMO_PASSWORD);
      // scrypt-хеш Better Auth не похож на открытый текст.
      expect(account.password?.length ?? 0).toBeGreaterThan(32);
    }
  });

  it("наполняет два семестра оценками, зачётами и сессией двух разных студентов", async () => {
    const profiles = await prisma.studentProfile.findMany({
      where: { user: { email: { in: EXPECTED_STUDENTS.map((student) => student.email) } } },
      select: { id: true, user: { select: { email: true } } },
    });
    const profileId = (email: string): string => {
      const profile = profiles.find((item) => item.user.email === email);
      if (!profile) {
        throw new Error(`Профиль ${email} не найден; проверьте seed.`);
      }
      return profile.id;
    };

    const annaId = profileId("anna.petrova@example.com");
    const markId = profileId("mark.sokolov@example.com");

    const [annaGrades, markGrades] = await Promise.all([
      prisma.grade.findMany({
        where: { studentProfileId: annaId },
        select: {
          semesterId: true,
          assessmentType: true,
          credits: true,
          score: true,
          status: true,
        },
      }),
      prisma.grade.findMany({
        where: { studentProfileId: markId },
        select: {
          semesterId: true,
          assessmentType: true,
          credits: true,
          score: true,
          status: true,
        },
      }),
    ]);

    // У каждого студента записи в текущем и прошлом семестре.
    expect(annaGrades.length).toBeGreaterThanOrEqual(8);
    expect(markGrades.length).toBeGreaterThanOrEqual(8);
    expect(new Set(annaGrades.map((grade) => grade.semesterId)).size).toBe(2);
    expect(new Set(markGrades.map((grade) => grade.semesterId)).size).toBe(2);

    // Зачёт без числовой оценки не путается с незачётом.
    expect(
      annaGrades.some(
        (grade) =>
          grade.assessmentType === "CREDIT" && grade.score === null && grade.status === "PASSED",
      ),
    ).toBe(true);
    expect(
      markGrades.some((grade) => grade.assessmentType === "CREDIT" && grade.status === "FAILED"),
    ).toBe(true);
    expect(new Set(annaGrades.map((grade) => grade.status))).toEqual(
      new Set(["PASSED", "NOT_GRADED"]),
    );
    expect(new Set(markGrades.map((grade) => grade.status))).toEqual(
      new Set(["PASSED", "FAILED", "NOT_GRADED"]),
    );

    const averageScore = (grades: typeof annaGrades): number => {
      const scores = grades.flatMap((grade) => (grade.score === null ? [] : [grade.score]));
      return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    };
    expect(averageScore(annaGrades)).toBeGreaterThan(averageScore(markGrades) + 1);

    // Сессия общей группы: есть испытания в обоих семестрах и разные результаты.
    const groups = await prisma.group.findMany({
      where: { code: { in: EXPECTED_STUDENTS.map((student) => student.groupCode) } },
      select: { id: true },
    });
    const groupIds = groups.map((group) => group.id);
    const exams = await prisma.exam.findMany({
      where: { groupId: { in: groupIds } },
      select: { groupId: true, semesterId: true },
    });

    expect(exams.length).toBeGreaterThanOrEqual(16);
    expect(new Set(exams.map((exam) => exam.semesterId)).size).toBe(2);
    for (const groupId of groupIds) {
      expect(exams.filter((exam) => exam.groupId === groupId).length).toBeGreaterThanOrEqual(8);
    }
  });

  it("повторный seed идемпотентен и не создаёт дублей", async () => {
    const before = {
      users: await prisma.user.count(),
      profiles: await prisma.studentProfile.count(),
      accounts: await prisma.account.count(),
      grades: await prisma.grade.count(),
      exams: await prisma.exam.count(),
    };

    runSeed();

    const after = {
      users: await prisma.user.count(),
      profiles: await prisma.studentProfile.count(),
      accounts: await prisma.account.count(),
      grades: await prisma.grade.count(),
      exams: await prisma.exam.count(),
    };

    expect(before).toMatchObject({ users: 2, profiles: 2, accounts: 2 });
    expect(before.grades).toBeGreaterThanOrEqual(18);
    expect(before.exams).toBeGreaterThanOrEqual(16);
    expect(after).toEqual(before);
  });
});
