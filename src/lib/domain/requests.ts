import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RequestStatus } from "@/generated/prisma/enums";
import { generateVerifyCode, isCertificateType } from "@/lib/domain/certificates";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import {
  buildRequestCreatedNotification,
  buildRequestStatusNotification,
  getRequestStatusDedupeKey,
  REQUEST_NOTIFICATION_SOURCE,
} from "@/lib/domain/request-notifications";
import { assertOwnership } from "@/lib/domain/access";
import { addMoscowWorkingDays, getMoscowYear } from "@/lib/domain/request-time";
import {
  canTransition,
  getAllowedTransitions,
  type RequestActorRole,
} from "@/lib/domain/request-status";
import type {
  CreateRequestInput,
  RequestListQuery,
  RequestPayloadInput,
  RequestQueueQuery,
  RequestStatusTransitionInput,
  RequestTypeCode,
} from "@/lib/validation/requests";
import { REQUEST_TYPE_CODES, requestPayloadSchema } from "@/lib/validation/requests";

/** Сколько заявок студент может создать за скользящее окно. */
export const REQUEST_RATE_LIMIT = 10;
export const REQUEST_RATE_WINDOW_MS = 10 * 60 * 1000;

/** Коллизия `verifyCode` разрешается повторной генерацией, не более трёх попыток. */
export const VERIFY_CODE_MAX_ATTEMPTS = 3;

export type RequestActor = {
  userId: string;
  role: RequestActorRole;
};

export type RequestCatalogItem = {
  code: RequestTypeCode;
  title: string;
  description: string;
  processingDays: number;
};

/** Use the same active type and working-day policy as request creation. */
export async function listActiveRequestTypes(): Promise<RequestCatalogItem[]> {
  const rows = await prisma.requestType.findMany({
    where: { isActive: true, code: { in: [...REQUEST_TYPE_CODES] } },
    select: { code: true, title: true, description: true, processingDays: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return rows.map(({ code, ...row }) => ({ ...row, code: code as RequestTypeCode }));
}

export type RequestSummary = {
  id: string;
  number: string;
  typeCode: RequestTypeCode;
  typeTitle: string;
  status: RequestStatus;
  createdAt: Date;
  dueAt: Date | null;
  rejectionReason: string | null;
};

export type RequestHistoryEntry = {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
  changedByName: string | null;
  createdAt: Date;
};

export type RequestDetail = RequestSummary & {
  /** `null`, если сохранённый payload не проходит текущую схему типа. */
  payload: RequestPayloadInput["payload"] | null;
  history: RequestHistoryEntry[];
  canCancel: boolean;
  /** Сотруднику нужны данные студента для обработки; студент их не получает. */
  student: RequestStudent | null;
  assignedToName: string | null;
  allowedTransitions: RequestStatus[];
  /** Название дисциплины для заявки на пересдачу; иначе `null`. */
  disciplineName: string | null;
};

export type RequestStudent = {
  fullName: string;
  studentNumber: string;
  groupCode: string;
  facultyName: string;
  programName: string;
};

export type RequestQueueItem = {
  id: string;
  number: string;
  typeCode: RequestTypeCode;
  typeTitle: string;
  status: RequestStatus;
  createdAt: Date;
  dueAt: Date | null;
  studentName: string;
  studentNumber: string;
  groupCode: string;
  facultyName: string;
  assignedToName: string | null;
};

export type RequestCreated = {
  id: string;
  number: string;
  typeCode: RequestTypeCode;
  typeTitle: string;
  status: RequestStatus;
  createdAt: Date;
  dueAt: Date | null;
};

const summarySelect = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  dueAt: true,
  rejectionReason: true,
  type: { select: { code: true, title: true } },
} satisfies Prisma.RequestSelect;

type RequestSummaryRow = Prisma.RequestGetPayload<{ select: typeof summarySelect }>;

const queueSelect = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  dueAt: true,
  type: { select: { code: true, title: true } },
  student: {
    select: {
      studentNumber: true,
      user: { select: { name: true } },
      group: { select: { code: true } },
      faculty: { select: { name: true } },
    },
  },
  assignedTo: { select: { name: true } },
} satisfies Prisma.RequestSelect;

type RequestQueueRow = Prisma.RequestGetPayload<{ select: typeof queueSelect }>;

function toSummary(row: RequestSummaryRow): RequestSummary {
  return {
    id: row.id,
    number: row.number,
    typeCode: row.type.code as RequestTypeCode,
    typeTitle: row.type.title,
    status: row.status,
    createdAt: row.createdAt,
    dueAt: row.dueAt,
    rejectionReason: row.rejectionReason,
  };
}

function toCreated(row: RequestSummaryRow): RequestCreated {
  return {
    id: row.id,
    number: row.number,
    typeCode: row.type.code as RequestTypeCode,
    typeTitle: row.type.title,
    status: row.status,
    createdAt: row.createdAt,
    dueAt: row.dueAt,
  };
}

/** Профиль студента — единственный источник `studentId`; из клиента он не берётся. */
async function getStudentProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  return profile?.id ?? null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function findByIdempotencyKey(
  studentId: string,
  clientRequestId: string,
): Promise<RequestSummaryRow | null> {
  return prisma.request.findUnique({
    where: { studentId_clientRequestId: { studentId, clientRequestId } },
    select: summarySelect,
  });
}

function ensureSameType(existing: RequestSummaryRow, typeCode: RequestTypeCode): RequestCreated {
  if (existing.type.code !== typeCode) {
    throw new AppError("CONFLICT", { userMessage: "Обновите страницу и повторите." });
  }

  return toCreated(existing);
}

/**
 * Создаёт заявку в одной транзакции: номер, срок, статус `NEW`, первая запись
 * истории и уведомление. Сбой уведомления откатывает всю транзакцию.
 *
 * `userId` берётся только из проверенной сессии. Повтор с тем же
 * `clientRequestId` возвращает существующую заявку и не создаёт вторую.
 */
export async function createRequestForUser(
  userId: string,
  input: CreateRequestInput,
  now: Date = new Date(),
): Promise<RequestCreated> {
  const studentId = await getStudentProfileId(userId);

  if (!studentId) {
    throw new AppError("FORBIDDEN");
  }

  const existing = await findByIdempotencyKey(studentId, input.clientRequestId);
  if (existing) {
    return ensureSameType(existing, input.typeCode);
  }

  // Код проверки выдаётся только справкам; у остальных типов он остаётся `null`.
  const issuesVerifyCode = isCertificateType(input.typeCode);
  const maxAttempts = issuesVerifyCode ? VERIFY_CODE_MAX_ATTEMPTS : 1;
  let lastCollision: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const verifyCode = issuesVerifyCode ? generateVerifyCode() : null;

    try {
      return await prisma.$transaction(async (tx) => {
        const type = await tx.requestType.findFirst({
          where: { code: input.typeCode, isActive: true },
          select: { id: true, title: true, processingDays: true },
        });

        if (!type) {
          throw new AppError("VALIDATION", { userMessage: "Выбранный тип заявки недоступен." });
        }

        if (input.typeCode === "RETAKE") {
          const discipline = await tx.discipline.findUnique({
            where: { id: input.payload.disciplineId },
            select: { id: true },
          });

          if (!discipline) {
            throw new AppError("VALIDATION", { userMessage: "Выбранная дисциплина не найдена." });
          }
        }

        const windowStart = new Date(now.getTime() - REQUEST_RATE_WINDOW_MS);
        const recentCount = await tx.request.count({
          where: { studentId, createdAt: { gte: windowStart, lte: now } },
        });

        if (recentCount >= REQUEST_RATE_LIMIT) {
          throw new AppError("RATE_LIMITED");
        }

        const year = getMoscowYear(now);
        const [sequence] = await tx.$queryRaw<Array<{ lastNumber: number }>>`
        INSERT INTO "request_number_sequence" ("year", "lastNumber")
        VALUES (${year}, 1)
        ON CONFLICT ("year")
        DO UPDATE SET "lastNumber" = "request_number_sequence"."lastNumber" + 1
        RETURNING "lastNumber"
      `;

        if (!sequence) {
          throw new AppError("INTERNAL");
        }

        const number = `З-${year}-${String(sequence.lastNumber).padStart(6, "0")}`;
        const dueAt = addMoscowWorkingDays(now, type.processingDays);

        const request = await tx.request.create({
          data: {
            number,
            studentId,
            typeId: type.id,
            status: "NEW",
            payload: input.payload as Prisma.InputJsonValue,
            clientRequestId: input.clientRequestId,
            ...(verifyCode ? { verifyCode } : {}),
            dueAt,
            createdAt: now,
            updatedAt: now,
          },
          select: summarySelect,
        });

        const history = await tx.requestStatusHistory.create({
          data: {
            requestId: request.id,
            fromStatus: null,
            toStatus: "NEW",
            changedById: userId,
            createdAt: now,
          },
          select: { id: true },
        });

        const content = buildRequestCreatedNotification(number);

        await tx.notification.create({
          data: {
            category: "REQUESTS",
            source: REQUEST_NOTIFICATION_SOURCE,
            priority: content.priority,
            title: content.title,
            body: content.body,
            audienceType: "STUDENT",
            audienceStudentId: studentId,
            targetType: "REQUEST",
            targetId: request.id,
            dedupeKey: getRequestStatusDedupeKey(request.id, history.id),
            publishedAt: now,
          },
        });

        return toCreated(request);
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      // Параллельная отправка с тем же ключом: возвращаем уже созданную заявку.
      const raced = await findByIdempotencyKey(studentId, input.clientRequestId);

      if (raced) {
        return ensureSameType(raced, input.typeCode);
      }

      if (!issuesVerifyCode) {
        throw error;
      }

      // Коллизия `verifyCode`: повторяем всю транзакцию с новым кодом.
      lastCollision = error;
    }
  }

  throw new AppError("INTERNAL", { cause: lastCollision });
}

/** Заявки текущего студента от новых к старым; чужой профиль недоступен. */
export async function getMyRequests(
  userId: string,
  filter: RequestListQuery = {},
): Promise<RequestSummary[]> {
  const studentId = await getStudentProfileId(userId);

  if (!studentId) {
    return [];
  }

  const requests = await prisma.request.findMany({
    where: {
      studentId,
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: summarySelect,
  });

  return requests.map(toSummary);
}

/**
 * Активные заявки текущего студента: `NEW` и `IN_PROGRESS`, новые сверху.
 *
 * `userId` берётся только из проверенной серверной сессии; профиль отсутствует —
 * возвращается пустой список. Завершённые и отменённые заявки в блок не входят.
 */
export async function getActiveRequestsForUser(userId: string): Promise<RequestSummary[]> {
  const studentId = await getStudentProfileId(userId);

  if (!studentId) {
    return [];
  }

  const requests = await prisma.request.findMany({
    where: { studentId, status: { in: ["NEW", "IN_PROGRESS"] } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: summarySelect,
  });

  return requests.map(toSummary);
}

/**
 * Очередь сотрудника деканата. Без фильтра показывает активные заявки:
 * сначала новые, затем взятые в работу; внутри группы — старые сверху.
 * Явный фильтр статуса показывает выбранную колонку от новых к старым.
 *
 * Роль проверяется здесь, рядом с данными. Студент получает `FORBIDDEN`
 * и не может использовать очередь как способ увидеть чужие заявки.
 */
export async function listRequestQueueForActor(
  actor: RequestActor,
  filter: RequestQueueQuery = {},
): Promise<RequestQueueItem[]> {
  if (actor.role !== "DEAN_EMPLOYEE") {
    throw new AppError("FORBIDDEN");
  }

  const requests = await prisma.request.findMany({
    where: filter.status ? { status: filter.status } : { status: { in: ["NEW", "IN_PROGRESS"] } },
    select: queueSelect,
  });

  const statusRank: Record<RequestStatus, number> = {
    NEW: 0,
    IN_PROGRESS: 1,
    READY: 2,
    REJECTED: 3,
    CANCELLED: 4,
  };

  return requests.map(toQueueItem).sort((left, right) => {
    const rank = statusRank[left.status] - statusRank[right.status];
    if (rank !== 0) {
      return rank;
    }

    const direction = filter.status ? -1 : 1;
    return (left.createdAt.getTime() - right.createdAt.getTime()) * direction;
  });
}

function toQueueItem(row: RequestQueueRow): RequestQueueItem {
  return {
    id: row.id,
    number: row.number,
    typeCode: row.type.code as RequestTypeCode,
    typeTitle: row.type.title,
    status: row.status,
    createdAt: row.createdAt,
    dueAt: row.dueAt,
    studentName: row.student.user.name,
    studentNumber: row.student.studentNumber,
    groupCode: row.student.group.code,
    facultyName: row.student.faculty.name,
    assignedToName: row.assignedTo?.name ?? null,
  };
}

/**
 * Карточка заявки. Студент получает только свою заявку, чужой идентификатор
 * возвращает `null` — нейтральный ответ без раскрытия существования записи.
 */
export async function getRequest(
  actor: RequestActor,
  requestId: string,
): Promise<RequestDetail | null> {
  let studentId: string | null = null;

  if (actor.role === "STUDENT") {
    studentId = await getStudentProfileId(actor.userId);

    if (!studentId) {
      return null;
    }
  }

  // Статус и история читаются в одном снимке `REPEATABLE READ`: иначе два
  // отдельных SELECT могли попасть по разные стороны от конкурентного перехода
  // и карточка показала бы противоречивые данные (`BE-005`).
  const request = await prisma.$transaction(
    (tx) =>
      tx.request.findFirst({
        where: {
          id: requestId,
          ...(studentId ? { studentId } : {}),
        },
        select: {
          ...summarySelect,
          studentId: true,
          payload: true,
          assignedTo: { select: { name: true } },
          student: {
            select: {
              studentNumber: true,
              user: { select: { name: true } },
              group: { select: { code: true } },
              faculty: { select: { name: true } },
              program: { select: { name: true } },
            },
          },
          history: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              fromStatus: true,
              toStatus: true,
              comment: true,
              createdAt: true,
              changedBy: { select: { name: true } },
            },
          },
        },
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  if (!request) {
    return null;
  }

  if (actor.role === "STUDENT" && studentId) {
    // Инвариант поверх фильтра в запросе: даже при будущем рефакторинге выборки
    // студент не получит чужую заявку — ответ останется нейтральным `NOT_FOUND`.
    assertOwnership(request.studentId, studentId);
  }

  const parsedPayload = requestPayloadSchema.safeParse({
    typeCode: request.type.code as RequestTypeCode,
    payload: request.payload,
  });

  let disciplineName: string | null = null;

  if (parsedPayload.success && parsedPayload.data.typeCode === "RETAKE") {
    const discipline = await prisma.discipline.findUnique({
      where: { id: parsedPayload.data.payload.disciplineId },
      select: { name: true },
    });

    disciplineName = discipline?.name ?? null;
  }

  const isOwner = actor.role === "STUDENT" && request.studentId === studentId;

  return {
    ...toSummary(request),
    payload: parsedPayload.success ? parsedPayload.data.payload : null,
    history: request.history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      comment: entry.comment,
      changedByName: entry.changedBy?.name ?? null,
      createdAt: entry.createdAt,
    })),
    canCancel: isOwner && request.status === "NEW",
    student:
      actor.role === "DEAN_EMPLOYEE"
        ? {
            fullName: request.student.user.name,
            studentNumber: request.student.studentNumber,
            groupCode: request.student.group.code,
            facultyName: request.student.faculty.name,
            programName: request.student.program.name,
          }
        : null,
    assignedToName: request.assignedTo?.name ?? null,
    allowedTransitions: getAllowedTransitions(request.status, {
      role: actor.role,
      isOwner,
    }),
    disciplineName,
  };
}

/**
 * Отмена доступна только владельцу и только в `NEW`.
 *
 * Чужая или несуществующая заявка одинаково возвращают `NOT_FOUND`, чтобы
 * не раскрывать наличие записи.
 */
export async function cancelRequestForUser(
  userId: string,
  requestId: string,
  now: Date = new Date(),
): Promise<void> {
  const studentId = await getStudentProfileId(userId);

  if (!studentId) {
    throw new AppError("FORBIDDEN");
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.request.findFirst({
      where: { id: requestId, studentId },
      select: { id: true, number: true, status: true },
    });

    if (!request) {
      throw new AppError("NOT_FOUND", { userMessage: "Заявка не найдена." });
    }

    if (request.status !== "NEW") {
      throw new AppError("INVALID_TRANSITION");
    }

    const updated = await tx.request.updateMany({
      where: { id: request.id, studentId, status: "NEW" },
      data: { status: "CANCELLED", updatedAt: now },
    });

    if (updated.count === 0) {
      throw new AppError("CONFLICT");
    }

    const history = await tx.requestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: "NEW",
        toStatus: "CANCELLED",
        changedById: userId,
        createdAt: now,
      },
      select: { id: true },
    });

    const content = buildRequestStatusNotification("CANCELLED", request.number);

    await tx.notification.create({
      data: {
        category: "REQUESTS",
        source: REQUEST_NOTIFICATION_SOURCE,
        priority: content.priority,
        title: content.title,
        body: content.body,
        audienceType: "STUDENT",
        audienceStudentId: studentId,
        targetType: "REQUEST",
        targetId: request.id,
        dedupeKey: getRequestStatusDedupeKey(request.id, history.id),
        publishedAt: now,
      },
    });
  });
}

/**
 * Переход статуса сотрудником деканата.
 *
 * Роль проверяется здесь, рядом с данными, а не только в интерфейсе.
 * Переход и история пишутся в одной транзакции; параллельная смена статуса
 * приводит к `CONFLICT`, а не к перезаписи чужого решения.
 */
export async function transitionRequestStatusForActor(
  actor: RequestActor,
  input: RequestStatusTransitionInput,
  now: Date = new Date(),
): Promise<void> {
  if (actor.role !== "DEAN_EMPLOYEE") {
    throw new AppError("FORBIDDEN");
  }

  // Обрезаем причину здесь же: прямой вызов домена не должен сохранять
  // строку из пробелов как «заполненную» (§ 4.4, обязательная причина).
  const comment = input.comment?.trim() || null;

  if (input.toStatus === "REJECTED" && !comment) {
    throw new AppError("VALIDATION", { userMessage: "Укажите причину отклонения." });
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.request.findUnique({
      where: { id: input.requestId },
      select: { id: true, number: true, status: true, studentId: true },
    });

    if (!request) {
      throw new AppError("NOT_FOUND", { userMessage: "Заявка не найдена." });
    }

    const allowed = canTransition(request.status, input.toStatus, {
      role: actor.role,
      isOwner: false,
    });

    if (!allowed) {
      throw new AppError("INVALID_TRANSITION");
    }

    const updated = await tx.request.updateMany({
      where: { id: request.id, status: request.status },
      data: {
        status: input.toStatus,
        updatedAt: now,
        ...(input.toStatus === "REJECTED" ? { rejectionReason: comment } : {}),
        ...(input.toStatus === "IN_PROGRESS" ? { assignedToId: actor.userId } : {}),
      },
    });

    if (updated.count === 0) {
      throw new AppError("CONFLICT");
    }

    const history = await tx.requestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: request.status,
        toStatus: input.toStatus,
        comment,
        changedById: actor.userId,
        createdAt: now,
      },
      select: { id: true },
    });

    const content = buildRequestStatusNotification(input.toStatus, request.number);

    await tx.notification.create({
      data: {
        category: "REQUESTS",
        source: REQUEST_NOTIFICATION_SOURCE,
        priority: content.priority,
        title: content.title,
        body: content.body,
        audienceType: "STUDENT",
        audienceStudentId: request.studentId,
        targetType: "REQUEST",
        targetId: request.id,
        dedupeKey: getRequestStatusDedupeKey(request.id, history.id),
        publishedAt: now,
      },
    });
  });
}
