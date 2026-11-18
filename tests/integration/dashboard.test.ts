import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import { getDashboardData } from "@/lib/domain/dashboard";
import { getSemesterOverview } from "@/lib/domain/grades";
import { getUnreadCountForUser, getUnreadNotificationsForUser } from "@/lib/domain/notifications";
import { getActiveRequestsForUser } from "@/lib/domain/requests";

const prisma = createPrismaClient();

/** Фиксированное «сейчас»: 12:00 по Москве, результат не зависит от даты прогона. */
const NOW = new Date("2026-11-17T09:00:00.000Z");

type SeedStudent = {
  userId: string;
  profileId: string;
};

type Fixture = {
  anna: SeedStudent;
  lessonStudent: { userId: string; profileId: string };
  emptyStudent: { userId: string; profileId: string };
  groupA: { id: string; code: string };
  groupC: { id: string; code: string };
  ownLessonId: string;
  ownExamId: string;
  foreignNotificationTitle: string;
};

let fixture: Fixture;

const createdNotificationIds: string[] = [];
const createdLessonIds: string[] = [];
const createdExamIds: string[] = [];
const createdUserIds: string[] = [];
const createdGroupIds: string[] = [];
const createdProgramIds: string[] = [];
const createdFacultyIds: string[] = [];

async function findSeedStudent(email: string): Promise<SeedStudent> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, studentProfile: { select: { id: true } } },
  });

  if (!user?.studentProfile) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return { userId: user.id, profileId: user.studentProfile.id };
}

async function createGroup(
  programId: string,
  label: string,
): Promise<{ id: string; code: string }> {
  const group = await prisma.group.create({
    data: { code: `TEST-DASH-${label}-${randomUUID()}`, programId },
    select: { id: true, code: true },
  });
  createdGroupIds.push(group.id);

  return group;
}

async function createStudent(params: {
  name: string;
  facultyId: string;
  programId: string;
  groupId: string;
}): Promise<{ userId: string; profileId: string }> {
  const user = await prisma.user.create({
    data: {
      id: `test-dashboard-${randomUUID()}`,
      name: params.name,
      email: `test-dashboard-${randomUUID()}@example.com`,
      role: "STUDENT",
      studentProfile: {
        create: {
          studentNumber: `TEST-DASH-${randomUUID()}`,
          facultyId: params.facultyId,
          programId: params.programId,
          groupId: params.groupId,
          course: 1,
          studyForm: "BUDGET",
          enrolledAt: new Date("2025-09-01T00:00:00.000Z"),
        },
      },
    },
    select: { id: true, studentProfile: { select: { id: true } } },
  });

  if (!user.studentProfile) {
    throw new Error("Не удалось создать профиль тестового студента.");
  }

  createdUserIds.push(user.id);

  return { userId: user.id, profileId: user.studentProfile.id };
}

/** Семестр по тому же правилу, что и `getSemesterOverview`: текущий, иначе последний. */
async function pickSemesterId(): Promise<string> {
  const semesters = await prisma.semester.findMany({
    orderBy: [{ startsAt: "desc" }, { id: "asc" }],
    select: { id: true, startsAt: true, endsAt: true },
  });

  const now = NOW.getTime();
  const semester =
    semesters.find(
      (candidate) => candidate.startsAt.getTime() <= now && now <= candidate.endsAt.getTime(),
    ) ?? semesters[0];

  if (!semester) {
    throw new Error("В тестовой базе нет семестров; проверьте seed.");
  }

  return semester.id;
}

beforeAll(async () => {
  const anna = await findSeedStudent("anna.petrova@example.com");
  const mark = await findSeedStudent("mark.sokolov@example.com");

  const faculty = await prisma.faculty.create({
    data: {
      code: `TEST-DASH-F-${randomUUID()}`,
      name: "Тестовый факультет главного экрана",
    },
    select: { id: true },
  });
  createdFacultyIds.push(faculty.id);

  const program = await prisma.program.create({
    data: {
      code: `TEST-DASH-P-${randomUUID()}`,
      name: "Тестовая программа главного экрана",
      facultyId: faculty.id,
    },
    select: { id: true },
  });
  createdProgramIds.push(program.id);

  const studentName = "Тестовый студент расписания";
  const [groupA, groupB, groupC] = await Promise.all([
    createGroup(program.id, "A"),
    createGroup(program.id, "B"),
    createGroup(program.id, "C"),
  ]);

  const [lessonStudent, emptyStudent] = await Promise.all([
    createStudent({
      name: studentName,
      facultyId: faculty.id,
      programId: program.id,
      groupId: groupA.id,
    }),
    createStudent({
      name: "Тестовый студент без данных",
      facultyId: faculty.id,
      programId: program.id,
      groupId: groupC.id,
    }),
  ]);

  const [discipline, teacher, room] = await Promise.all([
    prisma.discipline.findFirst({ select: { id: true } }),
    prisma.teacher.findFirst({ select: { id: true } }),
    prisma.room.findFirst({ select: { id: true } }),
  ]);

  if (!discipline || !teacher || !room) {
    throw new Error("В тестовой базе нет дисциплины, преподавателя или аудитории; проверьте seed.");
  }

  const lessonData = {
    disciplineId: discipline.id,
    teacherId: teacher.id,
    roomId: room.id,
    type: "LECTURE" as const,
    subgroup: "ALL" as const,
    startsAt: new Date("2026-11-17T08:30:00.000Z"),
    endsAt: new Date("2026-11-17T10:00:00.000Z"),
  };

  const [ownLesson, foreignLesson] = await Promise.all([
    prisma.lesson.create({
      data: { ...lessonData, groupId: groupA.id },
      select: { id: true },
    }),
    prisma.lesson.create({
      data: { ...lessonData, groupId: groupB.id },
      select: { id: true },
    }),
  ]);
  createdLessonIds.push(ownLesson.id, foreignLesson.id);

  const semesterId = await pickSemesterId();
  const examData = {
    disciplineId: discipline.id,
    semesterId,
    assessmentType: "EXAM" as const,
    startsAt: new Date("2026-11-17T08:00:00.000Z"),
    endsAt: new Date("2026-11-17T10:00:00.000Z"),
  };

  const [ownExam, foreignExam] = await Promise.all([
    prisma.exam.create({
      data: { ...examData, groupId: groupA.id },
      select: { id: true },
    }),
    prisma.exam.create({
      data: { ...examData, groupId: groupB.id },
      select: { id: true },
    }),
  ]);
  createdExamIds.push(ownExam.id, foreignExam.id);

  const foreignNotificationTitle = `Чужое важное уведомление ${randomUUID()}`;
  const foreignNotification = await prisma.notification.create({
    data: {
      category: "DEANERY",
      priority: "IMPORTANT",
      title: foreignNotificationTitle,
      body: "Уведомление адресовано другому студенту и не должно попасть на главный экран.",
      audienceType: "STUDENT",
      audienceStudentId: mark.profileId,
      publishedAt: NOW,
    },
    select: { id: true },
  });
  createdNotificationIds.push(foreignNotification.id);

  fixture = {
    anna,
    lessonStudent,
    emptyStudent,
    groupA,
    groupC,
    ownLessonId: ownLesson.id,
    ownExamId: ownExam.id,
    foreignNotificationTitle,
  };
});

afterAll(async () => {
  if (createdNotificationIds.length > 0) {
    await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
  }

  if (createdLessonIds.length > 0) {
    await prisma.lesson.deleteMany({ where: { id: { in: createdLessonIds } } });
  }

  if (createdExamIds.length > 0) {
    await prisma.exam.deleteMany({ where: { id: { in: createdExamIds } } });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  if (createdGroupIds.length > 0) {
    await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  }

  if (createdProgramIds.length > 0) {
    await prisma.program.deleteMany({ where: { id: { in: createdProgramIds } } });
  }

  if (createdFacultyIds.length > 0) {
    await prisma.faculty.deleteMany({ where: { id: { in: createdFacultyIds } } });
  }

  await prisma.$disconnect();
});

describe("главный экран", () => {
  it("показывает занятие и экзамен своей группы", async () => {
    const data = await getDashboardData(fixture.lessonStudent.userId, NOW);

    expect(data.unavailable).toEqual([]);
    expect(data.student).toEqual({ firstName: "Тестовый", groupCode: fixture.groupA.code });
    expect(data.nearestLesson?.id).toBe(fixture.ownLessonId);
    expect(data.nearestLesson?.groupCode).toBe(fixture.groupA.code);
    expect(data.nearestExam?.id).toBe(fixture.ownExamId);
    expect(data.activeRequests).toEqual([]);
    expect(data.unreadNotifications).toEqual({ count: 0, items: [] });
  });

  it("возвращает пустые блоки для студента без данных", async () => {
    const data = await getDashboardData(fixture.emptyStudent.userId, NOW);

    expect(data.unavailable).toEqual([]);
    expect(data.student).toEqual({ firstName: "Тестовый", groupCode: fixture.groupC.code });
    expect(data.nearestLesson).toBeNull();
    expect(data.nearestExam).toBeNull();
    expect(data.gradesSummary?.state).toBe("NO_DATA");
    expect(data.activeRequests).toEqual([]);
    expect(data.unreadNotifications).toEqual({ count: 0, items: [] });
  });

  it("собирает только данные текущего студента", async () => {
    const data = await getDashboardData(fixture.anna.userId, NOW);

    expect(data.unavailable).toEqual([]);
    expect(data.unreadNotifications.items.map((item) => item.title)).not.toContain(
      fixture.foreignNotificationTitle,
    );
    expect(data.unreadNotifications.count).toBe(
      await getUnreadCountForUser(fixture.anna.userId, NOW),
    );
    expect(data.unreadNotifications.items.length).toBeLessThanOrEqual(3);
    expect(data.unreadNotifications.items.every((item) => item.isRead === false)).toBe(true);
    expect(data.unreadNotifications.count).toBeGreaterThanOrEqual(
      data.unreadNotifications.items.length,
    );

    const requestIds = data.activeRequests.map((request) => request.id);
    const owners = await prisma.request.findMany({
      where: { id: { in: requestIds } },
      select: { studentId: true },
    });
    expect(owners).toHaveLength(requestIds.length);
    expect(owners.every((request) => request.studentId === fixture.anna.profileId)).toBe(true);
  });

  it("совпадает с отдельными читателями блоков", async () => {
    const [data, overview, activeRequests] = await Promise.all([
      getDashboardData(fixture.anna.userId, NOW),
      getSemesterOverview(fixture.anna.userId, undefined, NOW),
      getActiveRequestsForUser(fixture.anna.userId),
    ]);

    expect(data.gradesSummary).toEqual(overview?.summary ?? null);
    expect(data.activeRequests).toEqual(activeRequests.slice(0, 3));
  });

  it("читает непрочитанные с приоритетом и лимитом", async () => {
    const [all, preview, data] = await Promise.all([
      getUnreadNotificationsForUser(fixture.anna.userId, 100, NOW),
      getUnreadNotificationsForUser(fixture.anna.userId, 3, NOW),
      getDashboardData(fixture.anna.userId, NOW),
    ]);

    expect(all.items.length).toBeLessThanOrEqual(all.count);
    expect(all.items.every((item) => item.isRead === false)).toBe(true);

    const priorities = all.items.map((item) => item.priority);
    const firstNormal = priorities.indexOf("NORMAL");
    if (firstNormal !== -1) {
      expect(priorities.slice(firstNormal)).not.toContain("IMPORTANT");
    }

    expect(preview.count).toBe(all.count);
    expect(preview.items.length).toBeLessThanOrEqual(3);
    expect(data.unreadNotifications).toEqual(preview);
  });
});
