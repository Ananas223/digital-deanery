import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelRequest as cancelRequestAction,
  createRequest as createRequestAction,
  getMyRequests as getMyRequestsAction,
  getRequest as getRequestAction,
  listRequestQueue as listRequestQueueAction,
  transitionRequestStatus as transitionRequestStatusAction,
} from "@/lib/actions/requests";
import { createPrismaClient } from "@/lib/db/client";
import { prisma as appPrisma } from "@/lib/db/prisma";
import {
  cancelRequestForUser,
  createRequestForUser,
  getMyRequests,
  getRequest,
  listActiveRequestTypes,
  listRequestQueueForActor,
  transitionRequestStatusForActor,
} from "@/lib/domain/requests";
import type { CreateRequestInput, RequestListQuery } from "@/lib/validation/requests";

const sessionMock = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: sessionMock.requireUser }));

const prisma = createPrismaClient();

const NOW = new Date("2026-11-17T09:00:00.000Z");
const RATE_NOW = new Date("2026-12-01T09:00:00.000Z");

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

beforeAll(async () => {
  const [anna, mark] = await Promise.all([
    findUser("anna.petrova@example.com"),
    findUser("mark.sokolov@example.com"),
  ]);

  const employee = await prisma.user.create({
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
    employeeId: employee.id,
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

describe("каталог заявок", () => {
  it("читает изменённый норматив из базы и не выдаёт отключённый тип", async () => {
    const study = await prisma.requestType.findUniqueOrThrow({
      where: { code: "STUDY_CERTIFICATE" },
    });
    const leave = await prisma.requestType.findUniqueOrThrow({ where: { code: "ACADEMIC_LEAVE" } });
    try {
      await prisma.$transaction([
        prisma.requestType.update({ where: { id: study.id }, data: { processingDays: 17 } }),
        prisma.requestType.update({ where: { id: leave.id }, data: { isActive: false } }),
      ]);
      const catalog = await listActiveRequestTypes();
      expect(catalog.find(({ code }) => code === study.code)).toEqual({
        code: study.code,
        title: study.title,
        description: study.description,
        processingDays: 17,
      });
      expect(catalog.map(({ code }) => code)).not.toContain(leave.code);
    } finally {
      await prisma.$transaction([
        prisma.requestType.update({
          where: { id: study.id },
          data: { processingDays: study.processingDays },
        }),
        prisma.requestType.update({ where: { id: leave.id }, data: { isActive: leave.isActive } }),
      ]);
    }
  });
});

describe("создание заявки", () => {
  it("сохраняет номер, срок, первую историю и уведомление", async () => {
    const clientRequestId = randomUUID();
    const created = await createStudy(fixture.annaId, NOW, clientRequestId);

    expect(created.number).toMatch(/^З-2026-\d{6}$/);
    expect(created.status).toBe("NEW");
    // Справка об обучении готовится 3 рабочих дня: пятница 20.11.2026.
    expect(created.dueAt?.toISOString()).toBe("2026-11-20T09:00:00.000Z");

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: {
        number: true,
        studentId: true,
        status: true,
        payload: true,
        clientRequestId: true,
        dueAt: true,
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.number).toBe(created.number);
    expect(stored?.studentId).toBe(fixture.annaProfileId);
    expect(stored?.status).toBe("NEW");
    expect(stored?.clientRequestId).toBe(clientRequestId);
    expect(stored?.payload).toEqual({ deliveryPlace: "Деканат факультета информатики" });

    const history = await prisma.requestStatusHistory.findMany({
      where: { requestId: created.id },
      select: { fromStatus: true, toStatus: true, changedById: true },
    });
    expect(history).toEqual([{ fromStatus: null, toStatus: "NEW", changedById: fixture.annaId }]);

    const notifications = await prisma.notification.findMany({
      where: { targetId: created.id },
      select: {
        category: true,
        title: true,
        audienceType: true,
        audienceStudentId: true,
        targetType: true,
        dedupeKey: true,
      },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      category: "REQUESTS",
      title: "Заявка создана",
      audienceType: "STUDENT",
      audienceStudentId: fixture.annaProfileId,
      targetType: "REQUEST",
    });
    expect(notifications[0]?.dedupeKey).toBeTruthy();
  });

  it("не создаёт вторую заявку при повторе clientRequestId", async () => {
    const clientRequestId = randomUUID();
    const first = await createStudy(fixture.annaId, NOW, clientRequestId);
    const second = await createRequestForUser(fixture.annaId, studyInput(clientRequestId), NOW);

    expect(second.id).toBe(first.id);
    expect(second.number).toBe(first.number);
    expect(
      await prisma.request.count({
        where: { studentId: fixture.annaProfileId, clientRequestId },
      }),
    ).toBe(1);
  });

  it("возвращает CONFLICT при повторе ключа с другим типом", async () => {
    const clientRequestId = randomUUID();
    await createStudy(fixture.annaId, NOW, clientRequestId);

    await expect(
      createRequestForUser(
        fixture.annaId,
        {
          typeCode: "PLACE_REQUIREMENT",
          clientRequestId,
          payload: {
            organizationName: "ООО «Пример»",
            deliveryPlace: "Отдел кадров, кабинет 210",
          },
        },
        NOW,
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "CONFLICT" });
  });

  it("возвращает существующую заявку при параллельной отправке (P2002)", async () => {
    const clientRequestId = randomUUID();
    const originalFindUnique = appPrisma.request.findUnique.bind(appPrisma.request);
    let lookups = 0;

    // Пропускаем предварительные проверки обоих параллельных вызовов,
    // чтобы второй гарантированно упёрся в уникальный индекс. Восстановление
    // после P2002 идёт третьим запросом и использует настоящую БД.
    const spy = vi.spyOn(appPrisma.request, "findUnique").mockImplementation(((
      args: Parameters<typeof originalFindUnique>[0],
    ) => {
      lookups += 1;

      return lookups <= 2 ? Promise.resolve(null) : originalFindUnique(args);
    }) as unknown as typeof originalFindUnique);

    try {
      const now = nextCreationTime();
      const [first, second] = await Promise.all([
        createRequestForUser(fixture.annaId, studyInput(clientRequestId), now),
        createRequestForUser(fixture.annaId, studyInput(clientRequestId), now),
      ]);
      track(first.id);

      expect(second.id).toBe(first.id);
      expect(second.number).toBe(first.number);
      expect(
        await prisma.request.count({
          where: { studentId: fixture.annaProfileId, clientRequestId },
        }),
      ).toBe(1);
    } finally {
      spy.mockRestore();
    }
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

    // Подменяем только уведомление внутри транзакции: остальные запросы идут
    // в настоящую БД, поэтому проверяется реальный откат Prisma.
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

  it("ограничивает создание десятью заявками за десять минут", async () => {
    for (let index = 0; index < 10; index += 1) {
      await createStudy(fixture.annaId, RATE_NOW);
    }

    await expect(createStudy(fixture.annaId, RATE_NOW)).rejects.toMatchObject({
      name: "AppError",
      code: "RATE_LIMITED",
    });
  });

  it("проверяет существование дисциплины для пересдачи", async () => {
    await expect(
      createRequestForUser(
        fixture.annaId,
        {
          typeCode: "RETAKE",
          clientRequestId: randomUUID(),
          payload: {
            disciplineId: "cm00000000000000000000000",
            reason: "Не сдал экзамен по уважительной причине",
          },
        },
        NOW,
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "VALIDATION" });
  });

  it("запрещает создание сотруднику без студенческого профиля", async () => {
    await expect(createRequestForUser(fixture.employeeId, studyInput(), NOW)).rejects.toMatchObject(
      { name: "AppError", code: "FORBIDDEN" },
    );
  });
});

describe("список и карточка заявки", () => {
  it("студент видит свои заявки и может фильтровать по статусу", async () => {
    const created = await createStudy(fixture.annaId);

    const all = await getMyRequests(fixture.annaId);
    expect(all.some((request) => request.id === created.id)).toBe(true);

    const newRequests = await getMyRequests(fixture.annaId, { status: "NEW" });
    expect(newRequests.some((request) => request.id === created.id)).toBe(true);
    expect(newRequests.every((request) => request.status === "NEW")).toBe(true);

    const ready = await getMyRequests(fixture.annaId, { status: "READY" });
    expect(ready.some((request) => request.id === created.id)).toBe(false);
  });

  it("не показывает заявку другому студенту", async () => {
    const created = await createStudy(fixture.annaId);

    const markList = await getMyRequests(fixture.markId);
    expect(markList.some((request) => request.id === created.id)).toBe(false);
  });

  it("возвращает владельцу данные, историю и возможность отмены", async () => {
    const created = await createStudy(fixture.annaId);

    const detail = await getRequest({ userId: fixture.annaId, role: "STUDENT" }, created.id);

    expect(detail).not.toBeNull();
    expect(detail?.number).toBe(created.number);
    expect(detail?.payload).toEqual({
      deliveryPlace: "Деканат факультета информатики",
    });
    expect(detail?.history).toHaveLength(1);
    expect(detail?.history[0]).toMatchObject({
      fromStatus: null,
      toStatus: "NEW",
      changedByName: "Анна Петрова",
    });
    expect(detail?.canCancel).toBe(true);
  });

  it("возвращает null на чужой идентификатор", async () => {
    const created = await createStudy(fixture.annaId);

    await expect(
      getRequest({ userId: fixture.markId, role: "STUDENT" }, created.id),
    ).resolves.toBeNull();
  });

  it("показывает карточку сотруднику деканата", async () => {
    const created = await createStudy(fixture.annaId);

    const detail = await getRequest(
      { userId: fixture.employeeId, role: "DEAN_EMPLOYEE" },
      created.id,
    );

    expect(detail?.id).toBe(created.id);
    expect(detail?.canCancel).toBe(false);
    expect(detail?.student?.fullName).toBe("Анна Петрова");
    expect(detail?.allowedTransitions).toEqual(["IN_PROGRESS"]);
  });

  it("строит очередь сотрудника: новые раньше взятых в работу", async () => {
    const first = await createStudy(fixture.annaId);
    const second = await createStudy(fixture.markId);

    const queue = await listRequestQueueForActor({
      userId: fixture.employeeId,
      role: "DEAN_EMPLOYEE",
    });

    const firstIndex = queue.findIndex((request) => request.id === first.id);
    const secondIndex = queue.findIndex((request) => request.id === second.id);

    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(
      queue.every((request) => request.status === "NEW" || request.status === "IN_PROGRESS"),
    ).toBe(true);
    expect(queue.find((request) => request.id === first.id)?.studentName).toBe("Анна Петрова");
  });

  it("фильтрует очередь по статусу и запрещает её студенту", async () => {
    const created = await createStudy(fixture.annaId);

    const ready = await listRequestQueueForActor(
      { userId: fixture.employeeId, role: "DEAN_EMPLOYEE" },
      { status: "READY" },
    );
    expect(ready.some((request) => request.id === created.id)).toBe(false);

    await expect(
      listRequestQueueForActor({ userId: fixture.annaId, role: "STUDENT" }),
    ).rejects.toMatchObject({ name: "AppError", code: "FORBIDDEN" });
  });
});

describe("отмена заявки", () => {
  it("отменяет новую заявку, сохраняет историю и уведомление", async () => {
    const created = await createStudy(fixture.annaId);

    await cancelRequestForUser(fixture.annaId, created.id, later(created));

    const history = await prisma.requestStatusHistory.findMany({
      where: { requestId: created.id },
      orderBy: { createdAt: "asc" },
      select: { fromStatus: true, toStatus: true },
    });
    expect(history).toEqual([
      { fromStatus: null, toStatus: "NEW" },
      { fromStatus: "NEW", toStatus: "CANCELLED" },
    ]);

    const notifications = await prisma.notification.findMany({
      where: { targetId: created.id },
      select: { title: true },
    });
    expect(notifications.map((notification) => notification.title)).toEqual([
      "Заявка создана",
      "Заявка отменена",
    ]);

    const detail = await getRequest({ userId: fixture.annaId, role: "STUDENT" }, created.id);
    expect(detail?.canCancel).toBe(false);
  });

  it("запрещает повторную отмену", async () => {
    const created = await createStudy(fixture.annaId);
    await cancelRequestForUser(fixture.annaId, created.id, later(created));

    await expect(
      cancelRequestForUser(fixture.annaId, created.id, later(created, 2)),
    ).rejects.toMatchObject({ name: "AppError", code: "INVALID_TRANSITION" });
  });

  it("запрещает отмену заявки в работе", async () => {
    const created = await createStudy(fixture.annaId);

    await transitionRequestStatusForActor(
      { userId: fixture.employeeId, role: "DEAN_EMPLOYEE" },
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );

    await expect(
      cancelRequestForUser(fixture.annaId, created.id, later(created, 2)),
    ).rejects.toMatchObject({ name: "AppError", code: "INVALID_TRANSITION" });
  });

  it("не раскрывает чужую заявку и не меняет её", async () => {
    const created = await createStudy(fixture.annaId);

    await expect(
      cancelRequestForUser(fixture.markId, created.id, later(created)),
    ).rejects.toMatchObject({ name: "AppError", code: "NOT_FOUND" });

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    expect(stored?.status).toBe("NEW");
  });

  it("считает некорректный идентификатор отсутствующей заявкой", async () => {
    await expect(cancelRequestForUser(fixture.annaId, "not-a-cuid", NOW)).rejects.toMatchObject({
      name: "AppError",
      code: "NOT_FOUND",
    });
  });
});

describe("переходы статусов", () => {
  const employee = () => ({ userId: fixture.employeeId, role: "DEAN_EMPLOYEE" as const });

  it("берёт заявку в работу и назначает сотрудника", async () => {
    const created = await createStudy(fixture.annaId);

    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true, assignedToId: true },
    });
    expect(stored).toEqual({ status: "IN_PROGRESS", assignedToId: fixture.employeeId });

    const history = await prisma.requestStatusHistory.findMany({
      where: { requestId: created.id },
      orderBy: { createdAt: "asc" },
      select: { fromStatus: true, toStatus: true },
    });
    expect(history).toEqual([
      { fromStatus: null, toStatus: "NEW" },
      { fromStatus: "NEW", toStatus: "IN_PROGRESS" },
    ]);

    const notification = await prisma.notification.findFirst({
      where: { targetId: created.id, title: "Заявка принята в работу" },
      select: { priority: true },
    });
    expect(notification?.priority).toBe("NORMAL");
  });

  it("завершает заявку в работе и создаёт важное уведомление", async () => {
    const created = await createStudy(fixture.annaId);
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "READY" },
      later(created, 2),
    );

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    expect(stored?.status).toBe("READY");

    const notification = await prisma.notification.findFirst({
      where: { targetId: created.id, title: "Заявка готова" },
      select: { priority: true },
    });
    expect(notification?.priority).toBe("IMPORTANT");
  });

  it("отклоняет заявку только с причиной и сохраняет её", async () => {
    const created = await createStudy(fixture.annaId);
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );

    await expect(
      transitionRequestStatusForActor(
        employee(),
        { requestId: created.id, toStatus: "REJECTED" },
        later(created, 2),
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "VALIDATION" });

    await transitionRequestStatusForActor(
      employee(),
      {
        requestId: created.id,
        toStatus: "REJECTED",
        comment: "Не приложены подтверждающие документы",
      },
      later(created, 3),
    );

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true, rejectionReason: true },
    });
    expect(stored).toEqual({
      status: "REJECTED",
      rejectionReason: "Не приложены подтверждающие документы",
    });
  });

  it("не принимает причину отклонения из пробелов", async () => {
    const created = await createStudy(fixture.annaId);
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );

    await expect(
      transitionRequestStatusForActor(
        employee(),
        { requestId: created.id, toStatus: "REJECTED", comment: "   " },
        later(created, 2),
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "VALIDATION" });
  });

  it("запрещает завершить новую заявку без работы", async () => {
    const created = await createStudy(fixture.annaId);

    await expect(
      transitionRequestStatusForActor(
        employee(),
        { requestId: created.id, toStatus: "READY" },
        later(created),
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "INVALID_TRANSITION" });
  });

  it("запрещает менять терминальный статус", async () => {
    const created = await createStudy(fixture.annaId);
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );
    await transitionRequestStatusForActor(
      employee(),
      { requestId: created.id, toStatus: "READY" },
      later(created, 2),
    );

    await expect(
      transitionRequestStatusForActor(
        employee(),
        { requestId: created.id, toStatus: "IN_PROGRESS" },
        later(created, 3),
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "INVALID_TRANSITION" });
  });

  it("запрещает студенту действия сотрудника", async () => {
    const created = await createStudy(fixture.annaId);

    await expect(
      transitionRequestStatusForActor(
        { userId: fixture.annaId, role: "STUDENT" },
        { requestId: created.id, toStatus: "IN_PROGRESS" },
        NOW,
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "FORBIDDEN" });
  });

  it("возвращает NOT_FOUND на несуществующую заявку", async () => {
    await expect(
      transitionRequestStatusForActor(
        employee(),
        { requestId: "cm00000000000000000000000", toStatus: "IN_PROGRESS" },
        NOW,
      ),
    ).rejects.toMatchObject({ name: "AppError", code: "NOT_FOUND" });
  });
});

describe("контракт Server Actions", () => {
  const studentSession = () => ({
    id: fixture.annaId,
    email: "anna.petrova@example.com",
    name: "Анна Петрова",
    role: "STUDENT" as const,
  });
  const employeeSession = () => ({
    id: fixture.employeeId,
    email: "dean.employee@example.com",
    name: "Сотрудник деканата",
    role: "DEAN_EMPLOYEE" as const,
  });

  beforeEach(() => {
    sessionMock.requireUser.mockReset();
  });

  it("создаёт заявку студентом через действие", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession());

    const result = await createRequestAction(studyInput());

    expect(result.ok).toBe(true);

    if (result.ok) {
      track(result.data.id);
      expect(result.data.number).toMatch(/^З-\d{4}-\d{6}$/);
      expect(result.data.status).toBe("NEW");
    }
  });

  it("возвращает VALIDATION_ERROR на некорректный ввод", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession());

    const result = await createRequestAction({ typeCode: "STUDY_CERTIFICATE" });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });

    if (!result.ok) {
      expect(result.error.message).toBe("Проверьте заполнение полей.");
      expect(result.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("запрещает сотруднику создавать заявку через действие", async () => {
    sessionMock.requireUser.mockResolvedValue(employeeSession());

    await expect(createRequestAction(studyInput())).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("запрещает студенту действие сотрудника через действие", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession());
    const created = await createStudy(fixture.annaId);

    await expect(
      transitionRequestStatusAction({ requestId: created.id, toStatus: "IN_PROGRESS" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    const stored = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    expect(stored?.status).toBe("NEW");
  });

  it("возвращает пустой список при некорректном фильтре", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession());

    await expect(
      getMyRequestsAction({ status: "UNKNOWN" } as unknown as RequestListQuery),
    ).resolves.toEqual([]);
  });

  it("возвращает null на некорректный идентификатор заявки", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession());

    await expect(getRequestAction("not-a-cuid")).resolves.toBeNull();
  });

  it("отвечает NOT_FOUND при отмене с некорректным идентификатором", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession());

    await expect(cancelRequestAction("not-a-cuid")).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("возвращает пустой список сотруднику деканата", async () => {
    sessionMock.requireUser.mockResolvedValue(employeeSession());

    await expect(getMyRequestsAction()).resolves.toEqual([]);
  });

  it("возвращает сотруднику очередь через действие", async () => {
    sessionMock.requireUser.mockResolvedValue(employeeSession());
    const created = await createStudy(fixture.annaId);

    const result = await listRequestQueueAction({ status: "NEW" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.some((request) => request.id === created.id)).toBe(true);
      expect(result.data.every((request) => request.status === "NEW")).toBe(true);
    }
  });

  it("запрещает студенту получать очередь через действие", async () => {
    sessionMock.requireUser.mockResolvedValue(studentSession());

    await expect(listRequestQueueAction()).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("возвращает VALIDATION_ERROR на некорректный фильтр очереди", async () => {
    sessionMock.requireUser.mockResolvedValue(employeeSession());

    await expect(
      listRequestQueueAction({ status: "UNKNOWN" } as unknown as { status: "NEW" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });
});
