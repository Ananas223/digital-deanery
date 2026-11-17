import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { RequestStatus } from "@/generated/prisma/enums";
import { createPrismaClient } from "@/lib/db/client";
import { prisma as appPrisma } from "@/lib/db/prisma";
import {
  buildRequestCreatedNotification,
  buildRequestStatusNotification,
  getRequestStatusDedupeKey,
} from "@/lib/domain/request-notifications";
import {
  cancelRequestForUser,
  createRequestForUser,
  transitionRequestStatusForActor,
} from "@/lib/domain/requests";
import type { CreateRequestInput } from "@/lib/validation/requests";

const prisma = createPrismaClient();

const NOW = new Date("2026-11-17T09:00:00.000Z");

type Fixture = {
  annaId: string;
  markId: string;
  annaProfileId: string;
  markProfileId: string;
  employeeId: string;
};

let fixture: Fixture;

const createdRequestIds: string[] = [];

/** Каждое обычное создание сдвигает часы, чтобы не упираться в лимит 10 за 10 минут. */
let creationOffset = 0;

function nextCreationTime(): Date {
  creationOffset += 1;
  return new Date(NOW.getTime() + creationOffset * 11 * 60 * 1000);
}

function later(created: { createdAt: Date }, minutes = 1): Date {
  return new Date(created.createdAt.getTime() + minutes * 60 * 1000);
}

function track(id: string): string {
  createdRequestIds.push(id);
  return id;
}

type ClientRequestId = CreateRequestInput["clientRequestId"];

function studyInput(clientRequestId: ClientRequestId = randomUUID()): CreateRequestInput {
  return {
    typeCode: "STUDY_CERTIFICATE",
    clientRequestId,
    payload: { deliveryPlace: "Деканат факультета информатики" },
  };
}

async function createStudy(
  userId: string,
  now: Date = nextCreationTime(),
  clientRequestId: ClientRequestId = randomUUID(),
) {
  const created = await createRequestForUser(userId, studyInput(clientRequestId), now);
  track(created.id);
  return created;
}

async function findUser(email: string): Promise<{ id: string; profileId: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, studentProfile: { select: { id: true } } },
  });

  if (!user?.studentProfile) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return { id: user.id, profileId: user.studentProfile.id };
}

const notificationSelect = {
  id: true,
  category: true,
  priority: true,
  title: true,
  body: true,
  audienceType: true,
  audienceStudentId: true,
  targetType: true,
  targetId: true,
  dedupeKey: true,
  publishedAt: true,
  createdById: true,
} as const;

/** Уведомления конкретной заявки: чужие цели в выборку не попадают. */
async function requestNotifications(requestId: string) {
  return prisma.notification.findMany({
    where: { targetId: requestId, category: "REQUESTS" },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    select: notificationSelect,
  });
}

type NotificationRow = Awaited<ReturnType<typeof requestNotifications>>[number];

async function requestHistory(requestId: string) {
  return prisma.requestStatusHistory.findMany({
    where: { requestId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, fromStatus: true, toStatus: true, createdAt: true },
  });
}

type HistoryRow = Awaited<ReturnType<typeof requestHistory>>[number];

function requireHistoryEntry(history: HistoryRow[], toStatus: RequestStatus): HistoryRow {
  const entry = history.find((candidate) => candidate.toStatus === toStatus);

  if (!entry) {
    throw new Error(`В истории заявки нет записи со статусом ${toStatus}.`);
  }

  return entry;
}

function requireNotification(notifications: NotificationRow[], title: string): NotificationRow {
  const notification = notifications.find((candidate) => candidate.title === title);

  if (!notification) {
    throw new Error(`Уведомление «${title}» не найдено.`);
  }

  return notification;
}

function requireKey(value: string | null): string {
  if (value === null) {
    throw new Error("У уведомления о заявке отсутствует ключ идемпотентности.");
  }

  return value;
}

const employee = () => ({ userId: fixture.employeeId, role: "DEAN_EMPLOYEE" as const });

beforeAll(async () => {
  const [anna, mark] = await Promise.all([
    findUser("anna.petrova@example.com"),
    findUser("mark.sokolov@example.com"),
  ]);

  const testEmployee = await prisma.user.create({
    data: {
      id: `test-dean-${randomUUID()}`,
      name: "Тестовый сотрудник деканата",
      email: `test-dean-${randomUUID()}@example.com`,
      role: "DEAN_EMPLOYEE",
    },
    select: { id: true },
  });

  fixture = {
    annaId: anna.id,
    markId: mark.id,
    annaProfileId: anna.profileId,
    markProfileId: mark.profileId,
    employeeId: testEmployee.id,
  };
});

afterAll(async () => {
  if (createdRequestIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { targetId: { in: createdRequestIds } },
    });
    await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
  }

  if (fixture.employeeId) {
    await prisma.user.deleteMany({ where: { id: fixture.employeeId } });
  }

  await prisma.$disconnect();
});

describe("уведомления о заявках", () => {
  it("создаёт одно уведомление при создании заявки", async () => {
    const created = await createStudy(fixture.annaId, NOW);

    const history = await requestHistory(created.id);
    expect(history.map((entry) => entry.toStatus)).toEqual(["NEW"]);
    const creationEntry = requireHistoryEntry(history, "NEW");

    const notifications = await requestNotifications(created.id);
    expect(notifications).toHaveLength(1);

    const notification = requireNotification(notifications, "Заявка создана");
    const expected = buildRequestCreatedNotification(created.number);

    expect(notification).toMatchObject({
      category: "REQUESTS",
      priority: expected.priority,
      title: expected.title,
      body: expected.body,
      audienceType: "STUDENT",
      audienceStudentId: fixture.annaProfileId,
      targetType: "REQUEST",
      targetId: created.id,
      dedupeKey: getRequestStatusDedupeKey(created.id, creationEntry.id),
      publishedAt: NOW,
      createdById: null,
    });
    expect(notification.priority).toBe("NORMAL");
    expect(notification.body).toContain(created.number);
    expect(notification.body).not.toMatch(/<[^>]*>/);
  });

  it("создаёт уведомление при переводе заявки в работу", async () => {
    const created = await createStudy(fixture.annaId);
    const at = later(created);

    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      at,
    );

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true, assignedToId: true },
    });
    expect(stored).toEqual({ status: "IN_PROGRESS", assignedToId: fixture.employeeId });

    const history = await requestHistory(created.id);
    expect(history.map((entry) => entry.toStatus)).toEqual(["NEW", "IN_PROGRESS"]);
    const transitionEntry = requireHistoryEntry(history, "IN_PROGRESS");

    const notifications = await requestNotifications(created.id);
    expect(notifications).toHaveLength(2);

    const notification = requireNotification(notifications, "Заявка принята в работу");
    const expected = buildRequestStatusNotification("IN_PROGRESS", created.number);

    expect(notification).toMatchObject({
      category: "REQUESTS",
      priority: "NORMAL",
      title: "Заявка принята в работу",
      body: expected.body,
      audienceType: "STUDENT",
      audienceStudentId: fixture.annaProfileId,
      targetType: "REQUEST",
      targetId: created.id,
      dedupeKey: getRequestStatusDedupeKey(created.id, transitionEntry.id),
      publishedAt: at,
      createdById: null,
    });
    expect(notification.body).toContain(created.number);
  });

  it("создаёт важное уведомление при готовности заявки", async () => {
    const created = await createStudy(fixture.annaId);

    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );
    const at = later(created, 2);
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "READY" },
      at,
    );

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    expect(stored?.status).toBe("READY");

    const history = await requestHistory(created.id);
    expect(history.map((entry) => entry.toStatus)).toEqual(["NEW", "IN_PROGRESS", "READY"]);
    const readyEntry = requireHistoryEntry(history, "READY");

    const notifications = await requestNotifications(created.id);
    expect(notifications).toHaveLength(3);

    const notification = requireNotification(notifications, "Заявка готова");
    const expected = buildRequestStatusNotification("READY", created.number);

    expect(notification).toMatchObject({
      category: "REQUESTS",
      priority: "IMPORTANT",
      title: "Заявка готова",
      body: expected.body,
      audienceStudentId: fixture.annaProfileId,
      targetId: created.id,
      dedupeKey: getRequestStatusDedupeKey(created.id, readyEntry.id),
      publishedAt: at,
    });
    expect(notification.priority).toBe("IMPORTANT");
  });

  it("создаёт важное уведомление при отклонении заявки с причиной", async () => {
    const created = await createStudy(fixture.annaId);

    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );
    const at = later(created, 2);
    const comment = "Не хватает документов";
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "REJECTED", comment },
      at,
    );

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true, rejectionReason: true },
    });
    expect(stored).toEqual({ status: "REJECTED", rejectionReason: comment });

    const history = await requestHistory(created.id);
    expect(history.map((entry) => entry.toStatus)).toEqual(["NEW", "IN_PROGRESS", "REJECTED"]);
    const rejectedEntry = requireHistoryEntry(history, "REJECTED");

    const notifications = await requestNotifications(created.id);
    expect(notifications).toHaveLength(3);

    const notification = requireNotification(notifications, "Заявка отклонена");
    const expected = buildRequestStatusNotification("REJECTED", created.number);

    expect(notification).toMatchObject({
      category: "REQUESTS",
      priority: "IMPORTANT",
      title: "Заявка отклонена",
      body: expected.body,
      audienceStudentId: fixture.annaProfileId,
      targetId: created.id,
      dedupeKey: getRequestStatusDedupeKey(created.id, rejectedEntry.id),
      publishedAt: at,
    });
    expect(notification.priority).toBe("IMPORTANT");
  });

  it("создаёт уведомление при отмене заявки студентом", async () => {
    const created = await createStudy(fixture.annaId);
    const at = later(created);

    await cancelRequestForUser(fixture.annaId, created.id, at);

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    expect(stored?.status).toBe("CANCELLED");

    const notifications = await requestNotifications(created.id);
    expect(notifications.map((notification) => notification.title)).toEqual([
      "Заявка создана",
      "Заявка отменена",
    ]);
    expect(
      notifications.every(
        (notification) =>
          notification.audienceType === "STUDENT" &&
          notification.audienceStudentId === fixture.annaProfileId,
      ),
    ).toBe(true);

    const cancelled = requireNotification(notifications, "Заявка отменена");
    const expected = buildRequestStatusNotification("CANCELLED", created.number);
    expect(cancelled).toMatchObject({
      priority: "NORMAL",
      body: expected.body,
      publishedAt: at,
    });
  });

  it("адресует уведомления только владельцу заявки", async () => {
    const annaRequest = await createStudy(fixture.annaId);
    const markRequest = await createStudy(fixture.markId);

    await transitionRequestStatusForActor(
      employee(),
      { requestId: markRequest.id, toStatus: "IN_PROGRESS" },
      later(markRequest),
    );

    const markNotifications = await requestNotifications(markRequest.id);
    expect(markNotifications).toHaveLength(2);
    expect(
      markNotifications.every(
        (notification) =>
          notification.audienceType === "STUDENT" &&
          notification.audienceStudentId === fixture.markProfileId,
      ),
    ).toBe(true);
    expect(
      markNotifications.some(
        (notification) => notification.audienceStudentId === fixture.annaProfileId,
      ),
    ).toBe(false);

    const annaNotifications = await requestNotifications(annaRequest.id);
    expect(annaNotifications).toHaveLength(1);
    expect(
      annaNotifications.every(
        (notification) => notification.audienceStudentId === fixture.annaProfileId,
      ),
    ).toBe(true);
    expect(
      annaNotifications.some(
        (notification) => notification.audienceStudentId === fixture.markProfileId,
      ),
    ).toBe(false);
  });

  it("держит по одному уведомлению на запись истории с уникальным ключом", async () => {
    const first = await createStudy(fixture.annaId);
    const second = await createStudy(fixture.annaId);

    await transitionRequestStatusForActor(
      employee(),
      { requestId: first.id, toStatus: "IN_PROGRESS" },
      later(first),
    );
    await transitionRequestStatusForActor(
      employee(),
      { requestId: first.id, toStatus: "READY" },
      later(first, 2),
    );

    const seenKeys = new Set<string>();

    for (const request of [first, second]) {
      const history = await requestHistory(request.id);
      const notifications = await requestNotifications(request.id);

      expect(notifications).toHaveLength(history.length);

      const expectedKeys = new Set(
        history.map((entry) => getRequestStatusDedupeKey(request.id, entry.id)),
      );
      const actualKeys = notifications.map((notification) => requireKey(notification.dedupeKey));

      expect(new Set(actualKeys)).toEqual(expectedKeys);

      for (const key of actualKeys) {
        expect(key).toMatch(/^request:[^:]+:status:[^:]+$/);
        expect(key.startsWith(`request:${request.id}:status:`)).toBe(true);
        expect(seenKeys.has(key)).toBe(false);
        seenKeys.add(key);
      }
    }

    expect(seenKeys.size).toBe(3 + 1);
  });

  it("откатывает создание заявки, если уведомление не сохранилось", async () => {
    const clientRequestId = randomUUID();
    const counts = async () => ({
      requests: await prisma.request.count({ where: { studentId: fixture.annaProfileId } }),
      history: await prisma.requestStatusHistory.count(),
      notifications: await prisma.notification.count({ where: { category: "REQUESTS" } }),
    });
    const before = await counts();

    const originalTransaction = appPrisma.$transaction.bind(appPrisma) as unknown as (
      arg: unknown,
      ...rest: unknown[]
    ) => Promise<unknown>;
    const failure = new Error("notification failure");

    // Подменяем только создание уведомления внутри транзакции: остальные запросы
    // идут в настоящую БД, поэтому проверяется реальный откат Prisma.
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
        createRequestForUser(fixture.annaId, studyInput(clientRequestId), nextCreationTime()),
      ).rejects.toThrow(failure);
    } finally {
      spy.mockRestore();
    }

    expect(await counts()).toEqual(before);
    expect(
      await prisma.request.count({
        where: { studentId: fixture.annaProfileId, clientRequestId },
      }),
    ).toBe(0);
  });
});
