import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import { prisma as appPrisma } from "@/lib/db/prisma";
import { getNotificationsForUser } from "@/lib/domain/notifications";
import {
  createRequestForUser,
  transitionRequestStatusForActor,
  type RequestCreated,
} from "@/lib/domain/requests";

const prisma = createPrismaClient();

const NOW = new Date("2026-11-17T09:00:00.000Z");

function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

type Fixture = {
  studentUserId: string;
  studentProfileId: string;
  employeeId: string;
  otherStudentId: string;
};

let fixture: Fixture;
let request: RequestCreated;

const createdRequestIds: string[] = [];
const createdUserIds: string[] = [];

const employee = () => ({ userId: fixture.employeeId, role: "DEAN_EMPLOYEE" as const });

async function createTestStudent(
  groupId: string,
  facultyId: string,
  programId: string,
): Promise<{ userId: string; profileId: string }> {
  const user = await prisma.user.create({
    data: {
      id: `test-event-${randomUUID()}`,
      name: "Тестовый студент событий",
      email: `test-event-${randomUUID()}@example.com`,
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
    select: { id: true, studentProfile: { select: { id: true } } },
  });

  if (!user.studentProfile) {
    throw new Error("Не удалось создать профиль тестового студента.");
  }

  createdUserIds.push(user.id);

  return { userId: user.id, profileId: user.studentProfile.id };
}

async function createStudyRequest(at: Date): Promise<RequestCreated> {
  const created = await createRequestForUser(
    fixture.studentUserId,
    {
      typeCode: "STUDY_CERTIFICATE",
      clientRequestId: randomUUID(),
      payload: { deliveryPlace: "Деканат факультета информатики" },
    },
    at,
  );

  createdRequestIds.push(created.id);
  return created;
}

async function requestNotifications(requestId: string) {
  return prisma.notification.findMany({
    where: { targetId: requestId },
    orderBy: { publishedAt: "asc" },
    select: {
      id: true,
      category: true,
      priority: true,
      title: true,
      audienceType: true,
      audienceStudentId: true,
      targetType: true,
      dedupeKey: true,
    },
  });
}

beforeAll(async () => {
  const anna = await prisma.user.findUnique({
    where: { email: "anna.petrova@example.com" },
    select: {
      id: true,
      studentProfile: {
        select: { id: true, groupId: true, facultyId: true, programId: true },
      },
    },
  });

  const mark = await prisma.user.findUnique({
    where: { email: "mark.sokolov@example.com" },
    select: { id: true },
  });

  if (!anna?.studentProfile || !mark) {
    throw new Error("Демо-пользователи не найдены; проверьте seed.");
  }

  const student = await createTestStudent(
    anna.studentProfile.groupId,
    anna.studentProfile.facultyId,
    anna.studentProfile.programId,
  );

  const employeeUser = await prisma.user.create({
    data: {
      id: `test-event-employee-${randomUUID()}`,
      name: "Тестовый сотрудник деканата",
      email: `test-event-employee-${randomUUID()}@example.com`,
      role: "DEAN_EMPLOYEE",
    },
    select: { id: true },
  });

  createdUserIds.push(employeeUser.id);

  fixture = {
    studentUserId: student.userId,
    studentProfileId: student.profileId,
    employeeId: employeeUser.id,
    otherStudentId: mark.id,
  };

  request = await createStudyRequest(NOW);
});

afterAll(async () => {
  if (createdRequestIds.length > 0) {
    await prisma.notification.deleteMany({ where: { targetId: { in: createdRequestIds } } });
    await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  await prisma.$disconnect();
});

describe("уведомления о заявке", () => {
  it("создаёт одно уведомление при создании заявки и показывает его владельцу", async () => {
    const notifications = await requestNotifications(request.id);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      category: "REQUESTS",
      priority: "NORMAL",
      title: "Заявка создана",
      audienceType: "STUDENT",
      audienceStudentId: fixture.studentProfileId,
      targetType: "REQUEST",
    });
    expect(notifications[0]?.dedupeKey).toBeTruthy();

    const feed = await getNotificationsForUser(
      fixture.studentUserId,
      { category: "REQUESTS" },
      undefined,
      NOW,
    );

    expect(feed.items.map((item) => item.id)).toContain(notifications[0]?.id);
    expect(feed.items.find((item) => item.id === notifications[0]?.id)?.targetId).toBe(request.id);
  });

  it("создаёт ровно одно уведомление на каждый переход статуса", async () => {
    await transitionRequestStatusForActor(
      employee(),
      { requestId: request.id, toStatus: "IN_PROGRESS" },
      minutesAfter(NOW, 1),
    );

    let notifications = await requestNotifications(request.id);
    expect(notifications).toHaveLength(2);
    expect(notifications[1]).toMatchObject({
      category: "REQUESTS",
      priority: "NORMAL",
      title: "Заявка принята в работу",
      targetType: "REQUEST",
    });

    await transitionRequestStatusForActor(
      employee(),
      { requestId: request.id, toStatus: "READY" },
      minutesAfter(NOW, 2),
    );

    notifications = await requestNotifications(request.id);
    expect(notifications).toHaveLength(3);
    expect(notifications[2]).toMatchObject({
      category: "REQUESTS",
      priority: "IMPORTANT",
      title: "Заявка готова",
      targetType: "REQUEST",
    });

    const dedupeKeys = notifications.map((notification) => notification.dedupeKey);
    expect(new Set(dedupeKeys).size).toBe(notifications.length);
    expect(dedupeKeys.every((key) => key?.startsWith(`request:${request.id}:status:`))).toBe(true);

    const feed = await getNotificationsForUser(
      fixture.studentUserId,
      { category: "REQUESTS" },
      undefined,
      NOW,
    );

    expect(feed.items.map((item) => item.id)).toEqual(
      notifications.map((notification) => notification.id).reverse(),
    );
    expect(feed.items[0]?.title).toBe("Заявка готова");
  });

  it("не показывает уведомления заявки другому студенту", async () => {
    const notifications = await requestNotifications(request.id);

    const otherFeed = await getNotificationsForUser(
      fixture.otherStudentId,
      { category: "REQUESTS" },
      undefined,
      NOW,
    );
    const ids = otherFeed.items.map((item) => item.id);

    expect(notifications.every((notification) => !ids.includes(notification.id))).toBe(true);
  });

  it("откатывает переход статуса, если уведомление не сохранилось", async () => {
    const second = await createStudyRequest(minutesAfter(NOW, 11));
    const before = {
      status: (
        await prisma.request.findUniqueOrThrow({
          where: { id: second.id },
          select: { status: true },
        })
      ).status,
      history: await prisma.requestStatusHistory.count({ where: { requestId: second.id } }),
      notifications: await prisma.notification.count({ where: { targetId: second.id } }),
    };

    const originalTransaction = appPrisma.$transaction.bind(appPrisma) as unknown as (
      arg: unknown,
      ...rest: unknown[]
    ) => Promise<unknown>;
    const failure = new Error("notification failure");

    // Подменяем только запись уведомления внутри транзакции: остальные
    // запросы идут в настоящую БД, поэтому проверяется реальный откат Prisma.
    const spy = vi.spyOn(appPrisma, "$transaction").mockImplementation(((
      arg: unknown,
      ...rest: unknown[]
    ): Promise<unknown> => {
      if (typeof arg !== "function") {
        return originalTransaction(arg, ...rest);
      }

      const callback = arg as (tx: unknown) => Promise<unknown>;
      const wrapped = (tx: unknown) => {
        const notification = (tx as { notification: object }).notification;
        const failingNotification = new Proxy(notification, {
          get(target, property) {
            if (property === "create") {
              return async () => {
                throw failure;
              };
            }

            const value = Reflect.get(target, property) as unknown;

            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        const proxy = new Proxy(tx as object, {
          get(target, property) {
            if (property === "notification") {
              return failingNotification;
            }

            const value = Reflect.get(target, property) as unknown;

            return typeof value === "function" ? value.bind(target) : value;
          },
        });

        return callback(proxy);
      };

      return originalTransaction(wrapped, ...rest);
    }) as never);

    try {
      await expect(
        transitionRequestStatusForActor(
          employee(),
          { requestId: second.id, toStatus: "IN_PROGRESS" },
          minutesAfter(NOW, 12),
        ),
      ).rejects.toThrow(failure);
    } finally {
      spy.mockRestore();
    }

    const after = {
      status: (
        await prisma.request.findUniqueOrThrow({
          where: { id: second.id },
          select: { status: true },
        })
      ).status,
      history: await prisma.requestStatusHistory.count({ where: { requestId: second.id } }),
      notifications: await prisma.notification.count({ where: { targetId: second.id } }),
    };

    expect(after).toEqual(before);
  });
});
