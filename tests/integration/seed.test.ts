import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import { buildRequestCreatedNotification } from "@/lib/domain/request-notifications";
import { getMoscowYear } from "@/lib/domain/request-time";

import { runLocalBin } from "../setup/run-local-bin";

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
  runLocalBin(rootDir, "tsx", ["prisma/seed.ts"], {
    ...process.env,
    DATABASE_URL: process.env["DATABASE_URL"],
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed тестовой базы", () => {
  it("создаёт двух демо-студентов и сотрудника деканата", async () => {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { email: true, name: true, role: true },
    });

    expect(users).toHaveLength(3);
    expect(users.map((user) => user.email)).toEqual([
      "anna.petrova@example.com",
      "elena.smirnova@example.com",
      "mark.sokolov@example.com",
    ]);
    expect(users.filter((user) => user.role === "STUDENT").map((user) => user.email)).toEqual([
      "anna.petrova@example.com",
      "mark.sokolov@example.com",
    ]);
    expect(users.find((user) => user.email === "elena.smirnova@example.com")?.role).toBe(
      "DEAN_EMPLOYEE",
    );
  });

  it("не создаёт студенческий профиль сотруднику деканата", async () => {
    const employee = await prisma.user.findUnique({
      where: { email: "elena.smirnova@example.com" },
      select: { role: true, studentProfile: { select: { id: true } } },
    });

    expect(employee?.role).toBe("DEAN_EMPLOYEE");
    expect(employee?.studentProfile).toBeNull();
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

    expect(accounts).toHaveLength(3);

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

    expect(before).toMatchObject({ users: 3, profiles: 2, accounts: 3 });
    expect(before.grades).toBeGreaterThanOrEqual(18);
    expect(before.exams).toBeGreaterThanOrEqual(16);
    expect(after).toEqual(before);
  });
});

describe("seed демо-заявок", () => {
  it("создаёт шесть демо-заявок с уведомлением о создании и не дублирует их", async () => {
    const year = getMoscowYear(new Date());
    const prefix = `З-${year}-`;

    const snapshot = async () => {
      const requests = await prisma.request.findMany({
        where: { number: { startsWith: prefix } },
        orderBy: { number: "asc" },
        select: { id: true, number: true },
      });
      const ids = requests.map((request) => request.id);
      const [statusHistory, notifications] = await Promise.all([
        prisma.requestStatusHistory.count({ where: { requestId: { in: ids } } }),
        prisma.notification.count({ where: { targetId: { in: ids }, category: "REQUESTS" } }),
      ]);

      return { requests, statusHistory, notifications };
    };

    const first = await snapshot();

    expect(first.requests).toHaveLength(6);
    expect(first.requests.map((request) => request.number)).toEqual([
      `${prefix}900001`,
      `${prefix}900002`,
      `${prefix}900003`,
      `${prefix}900004`,
      `${prefix}900005`,
      `${prefix}900006`,
    ]);
    expect(new Set(first.requests.map((request) => request.number)).size).toBe(6);
    // Шесть записей создания и шесть переходов статуса.
    expect(first.statusHistory).toBe(12);
    // По уведомлению на создание и на каждый переход.
    expect(first.notifications).toBe(12);

    for (const request of first.requests) {
      const created = buildRequestCreatedNotification(request.number);
      const creationNotifications = await prisma.notification.count({
        where: {
          targetId: request.id,
          category: "REQUESTS",
          title: created.title,
          body: created.body,
        },
      });

      expect(creationNotifications).toBe(1);
    }

    const sequence = await prisma.requestNumberSequence.findUnique({
      where: { year },
      select: { lastNumber: true },
    });
    // Счётчик должен стоять на последнем демо-номере (900006),
    // иначе первая реальная заявка столкнётся с демо-заявкой.
    expect(sequence?.lastNumber ?? 0).toBeGreaterThanOrEqual(900_006);

    runSeed();

    const second = await snapshot();

    expect(second.requests.map((request) => request.number)).toEqual(
      first.requests.map((request) => request.number),
    );
    expect(second.statusHistory).toBe(first.statusHistory);
    expect(second.notifications).toBe(first.notifications);
  });
});

describe("seed демо-уведомлений", () => {
  /**
   * Строки seed-уведомлений: объявления деканата, дедлайны и изменения
   * расписания. Уведомления заявок (`request:...`) в выборку не попадают.
   */
  const loadSeedNotifications = () =>
    prisma.notification.findMany({
      where: { dedupeKey: { startsWith: "seed:" } },
      orderBy: { dedupeKey: "asc" },
      select: {
        id: true,
        dedupeKey: true,
        category: true,
        priority: true,
        title: true,
        body: true,
        audienceType: true,
        audienceStudentId: true,
        audienceGroupId: true,
        audienceFacultyId: true,
        targetType: true,
        targetId: true,
        publishedAt: true,
        expiresAt: true,
      },
    });

  it("создаёт объявления деканата, дедлайны и изменения расписания", async () => {
    const rows = await loadSeedNotifications();

    expect(rows).toHaveLength(15);

    const byCategory = (category: (typeof rows)[number]["category"]) =>
      rows.filter((row) => row.category === category);

    expect(byCategory("DEANERY")).toHaveLength(3);
    expect(byCategory("DEADLINES")).toHaveLength(3);
    expect(byCategory("SCHEDULE")).toHaveLength(9);

    const keys = rows.flatMap((row) => (row.dedupeKey === null ? [] : [row.dedupeKey]));
    expect(keys).toHaveLength(15);
    expect(new Set(keys).size).toBe(15);
    expect(keys.every((key) => key.startsWith("seed:"))).toBe(true);

    for (const row of rows) {
      expect(row.title.trim().length).toBeGreaterThan(0);
      expect(row.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("заполняет ровно одно поле аудитории по её типу", async () => {
    const rows = await loadSeedNotifications();

    for (const row of rows) {
      const filled = [row.audienceStudentId, row.audienceGroupId, row.audienceFacultyId].filter(
        (value) => value !== null,
      );
      expect(filled).toHaveLength(1);

      const expected = {
        STUDENT: row.audienceStudentId,
        GROUP: row.audienceGroupId,
        FACULTY: row.audienceFacultyId,
      }[row.audienceType];
      expect(expected).not.toBeNull();
    }
  });

  it("показывает объявления деканата всем трём аудиториям", async () => {
    const deanery = (await loadSeedNotifications()).filter((row) => row.category === "DEANERY");

    expect(new Set(deanery.map((row) => row.audienceType))).toEqual(
      new Set(["STUDENT", "GROUP", "FACULTY"]),
    );
    expect(deanery.some((row) => row.priority === "IMPORTANT")).toBe(true);
    // Объявления без связанного объекта: перехода по карточке нет.
    expect(deanery.every((row) => row.targetType === "NONE" && row.targetId === null)).toBe(true);
  });

  it("оставляет дедлайны без связанного занятия и с ограниченным сроком", async () => {
    const deadlines = (await loadSeedNotifications()).filter((row) => row.category === "DEADLINES");

    expect(deadlines).toHaveLength(3);
    expect(deadlines.every((row) => row.targetType === "NONE" && row.targetId === null)).toBe(true);
    expect(deadlines.filter((row) => row.priority === "IMPORTANT")).toHaveLength(2);
    expect(deadlines.every((row) => row.expiresAt !== null)).toBe(true);
  });

  it("связывает уведомления расписания с девятью занятиями своих групп", async () => {
    const schedule = (await loadSeedNotifications()).filter((row) => row.category === "SCHEDULE");

    expect(schedule).toHaveLength(9);
    expect(schedule.every((row) => row.targetType === "LESSON" && row.targetId !== null)).toBe(
      true,
    );

    const targetIds = schedule.flatMap((row) => (row.targetId === null ? [] : [row.targetId]));
    expect(new Set(targetIds).size).toBe(9);

    const lessons = await prisma.lesson.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, groupId: true },
    });
    expect(lessons).toHaveLength(9);

    const groupIdByLesson = new Map(lessons.map((lesson) => [lesson.id, lesson.groupId]));
    for (const row of schedule) {
      const lessonGroupId = row.targetId === null ? undefined : groupIdByLesson.get(row.targetId);

      expect(lessonGroupId).toBeDefined();
      // Аудитория изменения расписания — группа занятия.
      expect(row.audienceGroupId).toBe(lessonGroupId);
    }
  });

  it("не меняет идентификаторы уведомлений при повторном seed", async () => {
    const before = await loadSeedNotifications();
    const totalBefore = await prisma.notification.count();

    runSeed();

    const after = await loadSeedNotifications();
    const totalAfter = await prisma.notification.count();

    expect(before).toHaveLength(15);
    expect(after.map((row) => ({ id: row.id, dedupeKey: row.dedupeKey }))).toEqual(
      before.map((row) => ({ id: row.id, dedupeKey: row.dedupeKey })),
    );
    expect(totalAfter).toBe(totalBefore);
  });
});
