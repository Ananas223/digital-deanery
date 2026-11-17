import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import {
  cancelRequestForUser,
  createRequestForUser,
  getMyRequests,
  getRequest,
  transitionRequestStatusForActor,
} from "@/lib/domain/requests";
import type { CreateRequestInput } from "@/lib/validation/requests";

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
    expect(history).toEqual([
      { fromStatus: null, toStatus: "NEW", changedById: fixture.annaId },
    ]);

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
    const second = await createRequestForUser(
      fixture.annaId,
      studyInput(clientRequestId),
      NOW,
    );

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
    await expect(
      createRequestForUser(fixture.employeeId, studyInput(), NOW),
    ).rejects.toMatchObject({ name: "AppError", code: "FORBIDDEN" });
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

    const detail = await getRequest(
      { userId: fixture.annaId, role: "STUDENT" },
      created.id,
    );

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

    const detail = await getRequest(
      { userId: fixture.annaId, role: "STUDENT" },
      created.id,
    );
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
