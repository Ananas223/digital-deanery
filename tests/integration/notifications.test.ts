import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationSource } from "@/generated/prisma/enums";
import {
  getNotifications as getNotificationsAction,
  getUnreadCount as getUnreadCountAction,
  markAllNotificationsRead as markAllNotificationsReadAction,
  markNotificationRead as markNotificationReadAction,
} from "@/lib/actions/notifications";
import { createPrismaClient } from "@/lib/db/client";
import {
  getNotificationsForUser,
  getUnreadCountForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "@/lib/domain/notifications";
import type { NotificationFilter } from "@/lib/validation/notifications";

const sessionMock = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: sessionMock.requireUser }));

const prisma = createPrismaClient();

const NOW = new Date("2026-11-17T09:00:00.000Z");

function hoursBefore(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

type TestUser = {
  userId: string;
  profileId: string;
  groupId: string;
  facultyId: string;
};

type Fixture = {
  anna: TestUser;
  mark: TestUser;
  feed: TestUser;
  paging: TestUser;
  peer: TestUser;
  employeeId: string;
};

type FeedNotifications = {
  deaneryNormal: { id: string };
  deaneryImportant: { id: string };
  schedule: { id: string };
  requests: { id: string };
  deadline: { id: string };
  group: { id: string };
  faculty: { id: string };
  expired: { id: string };
  foreignStudent: { id: string };
  foreignGroup: { id: string };
  foreignFaculty: { id: string };
};

let fixture: Fixture;
let feedNotifications: FeedNotifications;

const createdNotificationIds: string[] = [];
const createdUserIds: string[] = [];

type NotificationSeed = {
  category?: "DEANERY" | "SCHEDULE" | "REQUESTS" | "DEADLINES";
  source?: NotificationSource;
  priority?: "NORMAL" | "IMPORTANT";
  title?: string;
  body?: string;
  audienceType: "STUDENT" | "GROUP" | "FACULTY";
  audienceStudentId?: string | null;
  audienceGroupId?: string | null;
  audienceFacultyId?: string | null;
  targetType?: "REQUEST" | "LESSON" | "SECTION" | "NONE";
  targetId?: string | null;
  publishedAt?: Date;
  expiresAt?: Date | null;
};

function trackNotification<T extends { id: string }>(notification: T): T {
  createdNotificationIds.push(notification.id);
  return notification;
}

async function createNotification(seed: NotificationSeed) {
  const notification = await prisma.notification.create({
    data: {
      category: seed.category ?? "DEANERY",
      source: seed.source,
      priority: seed.priority ?? "NORMAL",
      title: seed.title ?? "Тестовое уведомление",
      body: seed.body ?? "Текст тестового уведомления.",
      audienceType: seed.audienceType,
      audienceStudentId: seed.audienceStudentId ?? null,
      audienceGroupId: seed.audienceGroupId ?? null,
      audienceFacultyId: seed.audienceFacultyId ?? null,
      targetType: seed.targetType ?? "NONE",
      targetId: seed.targetId ?? null,
      publishedAt: seed.publishedAt ?? NOW,
      expiresAt: seed.expiresAt ?? null,
    },
    select: { id: true },
  });

  return trackNotification(notification);
}

async function findSeedStudent(email: string): Promise<TestUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      studentProfile: {
        select: { id: true, groupId: true, facultyId: true, programId: true },
      },
    },
  });

  if (!user?.studentProfile) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return {
    userId: user.id,
    profileId: user.studentProfile.id,
    groupId: user.studentProfile.groupId,
    facultyId: user.studentProfile.facultyId,
  };
}

/** Тестовые студенты не пересекаются с seed-уведомлениями, кроме общих групп. */
async function createTestStudent(
  label: string,
  groupId: string,
  facultyId: string,
  programId: string,
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      id: `test-notify-${label}-${randomUUID()}`,
      name: `Тестовый студент ${label}`,
      email: `test-notify-${label}-${randomUUID()}@example.com`,
      role: "STUDENT",
      studentProfile: {
        create: {
          studentNumber: `TEST-${randomUUID()}`,
          facultyId,
          programId,
          groupId,
          course: 1,
          studyForm: "BUDGET",
          enrolledAt: new Date("2025-09-01T00:00:00.000Z"),
        },
      },
    },
    select: {
      id: true,
      studentProfile: { select: { id: true, groupId: true, facultyId: true } },
    },
  });

  if (!user.studentProfile) {
    throw new Error("Не удалось создать профиль тестового студента.");
  }

  createdUserIds.push(user.id);

  return {
    userId: user.id,
    profileId: user.studentProfile.id,
    groupId: user.studentProfile.groupId,
    facultyId: user.studentProfile.facultyId,
  };
}

beforeAll(async () => {
  const anna = await findSeedStudent("anna.petrova@example.com");
  const mark = await findSeedStudent("mark.sokolov@example.com");

  const annaFull = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: anna.profileId },
    select: { programId: true },
  });

  const [feed, paging, peer] = await Promise.all([
    createTestStudent("feed", anna.groupId, anna.facultyId, annaFull.programId),
    createTestStudent("paging", anna.groupId, anna.facultyId, annaFull.programId),
    createTestStudent("peer", anna.groupId, anna.facultyId, annaFull.programId),
  ]);

  const employee = await prisma.user.create({
    data: {
      id: `test-notify-employee-${randomUUID()}`,
      name: "Тестовый сотрудник деканата",
      email: `test-notify-employee-${randomUUID()}@example.com`,
      role: "DEAN_EMPLOYEE",
    },
    select: { id: true },
  });

  createdUserIds.push(employee.id);

  fixture = { anna, mark, feed, paging, peer, employeeId: employee.id };

  const [deaneryNormal, deaneryImportant, schedule, requests, deadline, group, faculty] =
    await Promise.all([
      createNotification({
        category: "DEANERY",
        audienceType: "STUDENT",
        audienceStudentId: feed.profileId,
        title: "Обычное объявление",
        publishedAt: hoursBefore(1),
      }),
      createNotification({
        category: "DEANERY",
        priority: "IMPORTANT",
        audienceType: "STUDENT",
        audienceStudentId: feed.profileId,
        title: "Важное объявление",
        publishedAt: hoursBefore(2),
      }),
      createNotification({
        category: "SCHEDULE",
        audienceType: "STUDENT",
        audienceStudentId: feed.profileId,
        title: "Изменение расписания",
        publishedAt: hoursBefore(3),
      }),
      createNotification({
        category: "REQUESTS",
        audienceType: "STUDENT",
        audienceStudentId: feed.profileId,
        title: "Статус заявки",
        publishedAt: hoursBefore(4),
      }),
      createNotification({
        category: "DEADLINES",
        audienceType: "STUDENT",
        audienceStudentId: feed.profileId,
        title: "Дедлайн",
        publishedAt: hoursBefore(5),
      }),
      createNotification({
        category: "DEANERY",
        audienceType: "GROUP",
        audienceGroupId: anna.groupId,
        title: "Объявление группы",
        publishedAt: hoursBefore(6),
      }),
      createNotification({
        category: "DEANERY",
        audienceType: "FACULTY",
        audienceFacultyId: anna.facultyId,
        title: "Объявление факультета",
        publishedAt: hoursBefore(7),
      }),
    ]);

  const [expired, foreignStudent, foreignGroup, foreignFaculty] = await Promise.all([
    createNotification({
      category: "DEANERY",
      audienceType: "STUDENT",
      audienceStudentId: feed.profileId,
      title: "Истёкшее объявление",
      publishedAt: hoursBefore(8),
      expiresAt: hoursBefore(1),
    }),
    createNotification({
      audienceType: "STUDENT",
      audienceStudentId: mark.profileId,
      title: "Личное уведомление другого студента",
      publishedAt: hoursBefore(9),
    }),
    createNotification({
      audienceType: "GROUP",
      audienceGroupId: mark.groupId,
      title: "Объявление чужой группы",
      publishedAt: hoursBefore(10),
    }),
    createNotification({
      audienceType: "FACULTY",
      audienceFacultyId: mark.facultyId,
      title: "Объявление чужого факультета",
      publishedAt: hoursBefore(11),
    }),
  ]);

  feedNotifications = {
    deaneryNormal,
    deaneryImportant,
    schedule,
    requests,
    deadline,
    group,
    faculty,
    expired,
    foreignStudent,
    foreignGroup,
    foreignFaculty,
  };
});

afterAll(async () => {
  if (createdNotificationIds.length > 0) {
    await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  await prisma.$disconnect();
});

describe("лента уведомлений", () => {
  it("показывает персональные, групповые и факультетские уведомления", async () => {
    const page = await getNotificationsForUser(
      fixture.feed.userId,
      { category: "ALL" },
      undefined,
      NOW,
    );

    const ownIds = new Set([
      feedNotifications.deaneryImportant.id,
      feedNotifications.deaneryNormal.id,
      feedNotifications.schedule.id,
      feedNotifications.requests.id,
      feedNotifications.deadline.id,
      feedNotifications.group.id,
      feedNotifications.faculty.id,
    ]);

    // Seed добавляет групповые и факультетские уведомления, поэтому проверяем
    // состав и порядок только среди уведомлений, созданных тестом.
    expect(page.items.map((item) => item.id).filter((id) => ownIds.has(id))).toEqual([
      feedNotifications.deaneryImportant.id,
      feedNotifications.deaneryNormal.id,
      feedNotifications.schedule.id,
      feedNotifications.requests.id,
      feedNotifications.deadline.id,
      feedNotifications.group.id,
      feedNotifications.faculty.id,
    ]);
    expect(page.nextCursor).toBeNull();
    expect(page.unreadCount).toBeGreaterThanOrEqual(ownIds.size);
    expect(page.items.every((item) => item.isRead === false)).toBe(true);
  });

  it("не показывает чужие и истёкшие уведомления", async () => {
    const page = await getNotificationsForUser(
      fixture.feed.userId,
      { category: "ALL" },
      undefined,
      NOW,
    );
    const ids = page.items.map((item) => item.id);

    expect(ids).not.toContain(feedNotifications.expired.id);
    expect(ids).not.toContain(feedNotifications.foreignStudent.id);
    expect(ids).not.toContain(feedNotifications.foreignGroup.id);
    expect(ids).not.toContain(feedNotifications.foreignFaculty.id);
  });

  it("по границе expiresAt помещает в архив только уже опубликованные сообщения своей аудитории", async () => {
    const own = await createNotification({
      category: "DEADLINES",
      source: "DEANERY",
      audienceType: "STUDENT",
      audienceStudentId: fixture.feed.profileId,
      publishedAt: hoursBefore(1),
      expiresAt: NOW,
    });
    const future = await createNotification({
      category: "DEADLINES",
      audienceType: "STUDENT",
      audienceStudentId: fixture.feed.profileId,
      publishedAt: new Date(NOW.getTime() + 3_600_000),
      expiresAt: NOW,
    });
    const foreign = await createNotification({
      category: "DEADLINES",
      audienceType: "GROUP",
      audienceGroupId: fixture.mark.groupId,
      publishedAt: hoursBefore(1),
      expiresAt: NOW,
    });
    const [active, archive, unread] = await Promise.all([
      getNotificationsForUser(fixture.feed.userId, { category: "DEADLINES" }, undefined, NOW),
      getNotificationsForUser(
        fixture.feed.userId,
        { category: "DEADLINES", scope: "ARCHIVE" },
        undefined,
        NOW,
      ),
      getUnreadCountForUser(fixture.feed.userId, NOW),
    ]);
    expect(archive.items.find(({ id }) => id === own.id)).toMatchObject({
      category: "DEADLINES",
      source: "DEANERY",
      publishedAt: hoursBefore(1),
    });
    expect(archive.items.map(({ id }) => id)).not.toContain(foreign.id);
    expect(archive.items.map(({ id }) => id)).not.toContain(future.id);
    expect(active.items.map(({ id }) => id)).not.toContain(own.id);
    expect(archive.unreadCount).toBe(active.unreadCount);
    expect(archive.unreadCount).toBe(unread);
  });

  it.each([
    ["DEANERY", ["deaneryImportant", "deaneryNormal", "group", "faculty"]],
    ["SCHEDULE", ["schedule"]],
    ["REQUESTS", ["requests"]],
    ["DEADLINES", ["deadline"]],
  ] as const)("фильтрует ленту по категории %s", async (category, expected) => {
    const page = await getNotificationsForUser(fixture.feed.userId, { category }, undefined, NOW);
    const ownIds = new Set(expected.map((key) => feedNotifications[key].id));
    const ids = page.items.map((item) => item.id).filter((id) => ownIds.has(id));

    expect(ids).toEqual(expected.map((key) => feedNotifications[key].id));
  });

  it("считает непрочитанные по всей ленте независимо от фильтра", async () => {
    const page = await getNotificationsForUser(
      fixture.feed.userId,
      { category: "SCHEDULE" },
      undefined,
      NOW,
    );

    expect(page.items.some((item) => item.id === feedNotifications.schedule.id)).toBe(true);
    expect(page.unreadCount).toBeGreaterThanOrEqual(7);
    expect(await getUnreadCountForUser(fixture.feed.userId, NOW)).toBe(page.unreadCount);
  });

  it("листает по курсору без дублей и пропусков", async () => {
    const baseline = await getNotificationsForUser(
      fixture.paging.userId,
      { category: "DEADLINES" },
      undefined,
      NOW,
    );
    expect(baseline.nextCursor).toBeNull();

    const data = Array.from({ length: 22 }, (_, index) => ({
      id: randomUUID(),
      category: "DEADLINES" as const,
      priority: "NORMAL" as const,
      title: `Дедлайн ${index + 1}`,
      body: "Текст тестового уведомления.",
      audienceType: "STUDENT" as const,
      audienceStudentId: fixture.paging.profileId,
      publishedAt: new Date(NOW.getTime() - index * 60 * 1000),
    }));

    await prisma.notification.createMany({ data });
    createdNotificationIds.push(...data.map((item) => item.id));

    const first = await getNotificationsForUser(
      fixture.paging.userId,
      { category: "DEADLINES" },
      undefined,
      NOW,
    );

    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBe(first.items[19]?.id);

    const second = await getNotificationsForUser(
      fixture.paging.userId,
      { category: "DEADLINES" },
      first.nextCursor ?? undefined,
      NOW,
    );

    const expectedTotal = baseline.items.length + data.length;

    expect(second.items).toHaveLength(expectedTotal - 20);
    expect(second.nextCursor).toBeNull();

    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(expectedTotal);
    expect(ids).toEqual(expect.arrayContaining(data.map((item) => item.id)));
  });
});

describe("отметка о прочтении", () => {
  it("сохраняет прочтение и уменьшает счётчик", async () => {
    const notification = await createNotification({
      audienceType: "STUDENT",
      audienceStudentId: fixture.peer.profileId,
      title: "Персональное уведомление для счётчика",
    });

    const before = await getUnreadCountForUser(fixture.peer.userId, NOW);

    await markNotificationReadForUser(fixture.peer.userId, notification.id, NOW);

    expect(await getUnreadCountForUser(fixture.peer.userId, NOW)).toBe(before - 1);

    const page = await getNotificationsForUser(
      fixture.peer.userId,
      { category: "ALL" },
      undefined,
      NOW,
    );
    expect(page.items.find((item) => item.id === notification.id)?.isRead).toBe(true);
    expect(page.unreadCount).toBe(before - 1);

    const stored = await prisma.notificationRead.findUnique({
      where: {
        notificationId_userId: { notificationId: notification.id, userId: fixture.peer.userId },
      },
      select: { readAt: true },
    });
    expect(stored?.readAt.toISOString()).toBe(NOW.toISOString());
  });

  it("не уменьшает счётчик при повторной отметке", async () => {
    const notification = await createNotification({
      audienceType: "STUDENT",
      audienceStudentId: fixture.peer.profileId,
    });

    await markNotificationReadForUser(fixture.peer.userId, notification.id, NOW);
    const afterFirst = await getUnreadCountForUser(fixture.peer.userId, NOW);

    await markNotificationReadForUser(
      fixture.peer.userId,
      notification.id,
      new Date(NOW.getTime() + 60_000),
    );

    expect(await getUnreadCountForUser(fixture.peer.userId, NOW)).toBe(afterFirst);
    expect(
      await prisma.notificationRead.count({
        where: { notificationId: notification.id, userId: fixture.peer.userId },
      }),
    ).toBe(1);
  });

  it("не даёт отметить чужое уведомление и не раскрывает его", async () => {
    await expect(
      markNotificationReadForUser(fixture.mark.userId, feedNotifications.deaneryNormal.id, NOW),
    ).rejects.toMatchObject({ name: "AppError", code: "NOT_FOUND" });

    await expect(
      markNotificationReadForUser(fixture.mark.userId, feedNotifications.group.id, NOW),
    ).rejects.toMatchObject({ name: "AppError", code: "NOT_FOUND" });

    expect(
      await prisma.notificationRead.count({
        where: { notificationId: feedNotifications.deaneryNormal.id },
      }),
    ).toBe(0);
  });

  it("хранит прочтение группового уведомления персонально", async () => {
    await markNotificationReadForUser(fixture.peer.userId, feedNotifications.group.id, NOW);

    const peerRead = await prisma.notificationRead.findUnique({
      where: {
        notificationId_userId: {
          notificationId: feedNotifications.group.id,
          userId: fixture.peer.userId,
        },
      },
      select: { id: true },
    });
    expect(peerRead).not.toBeNull();

    const annaRead = await prisma.notificationRead.findUnique({
      where: {
        notificationId_userId: {
          notificationId: feedNotifications.group.id,
          userId: fixture.anna.userId,
        },
      },
      select: { id: true },
    });
    expect(annaRead).toBeNull();

    const annaPage = await getNotificationsForUser(
      fixture.anna.userId,
      { category: "DEANERY" },
      undefined,
      NOW,
    );
    expect(annaPage.items.find((item) => item.id === feedNotifications.group.id)?.isRead).toBe(
      false,
    );
  });

  it("отмечает все доступные уведомления и обнуляет счётчик", async () => {
    const before = await getUnreadCountForUser(fixture.peer.userId, NOW);

    const result = await markAllNotificationsReadForUser(fixture.peer.userId, NOW);

    expect(result.count).toBe(before);
    expect(await getUnreadCountForUser(fixture.peer.userId, NOW)).toBe(0);
    expect((await markAllNotificationsReadForUser(fixture.peer.userId, NOW)).count).toBe(0);

    const page = await getNotificationsForUser(
      fixture.peer.userId,
      { category: "ALL" },
      undefined,
      NOW,
    );
    expect(page.items.every((item) => item.isRead)).toBe(true);
    expect(page.unreadCount).toBe(0);
  });

  it("не трогает чужие уведомления при отметке всех", async () => {
    await markAllNotificationsReadForUser(fixture.peer.userId, NOW);

    expect(
      await prisma.notificationRead.count({
        where: { notificationId: feedNotifications.deaneryNormal.id },
      }),
    ).toBe(0);
  });
});

describe("контракт Server Actions", () => {
  function studentSession(user: TestUser) {
    return {
      id: user.userId,
      email: "student@example.com",
      name: "Тестовый студент",
      role: "STUDENT" as const,
    };
  }

  beforeEach(() => {
    sessionMock.requireUser.mockReset();
  });

  it("возвращает ленту студенту", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession(fixture.feed));

    const page = await getNotificationsAction({ category: "DEANERY" });
    const ownIds = new Set([
      feedNotifications.deaneryImportant.id,
      feedNotifications.deaneryNormal.id,
      feedNotifications.group.id,
      feedNotifications.faculty.id,
    ]);
    const ownItems = page.items.filter((item) => ownIds.has(item.id));

    expect(ownItems).toHaveLength(4);
    expect(ownItems[0]?.id).toBe(feedNotifications.deaneryImportant.id);
    expect(page.unreadCount).toBeGreaterThanOrEqual(4);
  });

  it("считает непрочитанные через действие", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession(fixture.feed));

    await expect(getUnreadCountAction()).resolves.toBe(
      await getUnreadCountForUser(fixture.feed.userId),
    );
  });

  it("отклоняет неизвестную категорию", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession(fixture.feed));

    await expect(
      getNotificationsAction({ category: "SYSTEM" } as unknown as NotificationFilter),
    ).rejects.toMatchObject({ name: "AppError", code: "VALIDATION" });
  });

  it("отклоняет некорректный курсор", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession(fixture.feed));

    await expect(getNotificationsAction({ category: "ALL" }, "next")).rejects.toMatchObject({
      name: "AppError",
      code: "VALIDATION",
    });
  });

  it("отмечает уведомление и возвращает нейтральную ошибку на чужое", async () => {
    const own = await createNotification({
      audienceType: "STUDENT",
      audienceStudentId: fixture.feed.profileId,
    });

    sessionMock.requireUser.mockResolvedValue(studentSession(fixture.feed));

    await expect(markNotificationReadAction(own.id)).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    await expect(markNotificationReadAction("not-a-cuid")).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("отмечает все и возвращает число новых отметок", async () => {
    const target = await createTestStudent(
      "action-counter",
      fixture.anna.groupId,
      fixture.anna.facultyId,
      (
        await prisma.studentProfile.findUniqueOrThrow({
          where: { id: fixture.anna.profileId },
          select: { programId: true },
        })
      ).programId,
    );

    sessionMock.requireUser.mockResolvedValue(studentSession(target));

    const result = await markAllNotificationsReadAction();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.count).toBeGreaterThan(0);
    }
    await expect(getUnreadCountAction()).resolves.toBe(0);
  });

  it("не даёт сотруднику деканата студенческую ленту", async () => {
    sessionMock.requireUser.mockResolvedValue({
      id: fixture.employeeId,
      email: "employee@example.com",
      name: "Сотрудник деканата",
      role: "DEAN_EMPLOYEE" as const,
    });

    await expect(getNotificationsAction({ category: "ALL" })).resolves.toEqual({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    });
    await expect(getUnreadCountAction()).resolves.toBe(0);
    await expect(markAllNotificationsReadAction()).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    await expect(
      markNotificationReadAction(feedNotifications.deaneryNormal.id),
    ).resolves.toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
