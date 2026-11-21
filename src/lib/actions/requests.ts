"use server";

import { requireUser } from "@/lib/auth/session";
import type {
  RequestCatalogItem,
  RequestCreated,
  RequestDetail,
  RequestQueueItem,
  RequestSummary,
} from "@/lib/domain/requests";
import {
  cancelRequestForUser,
  createRequestForUser,
  getMyRequests as getMyRequestsForUser,
  getRequest as getRequestForActor,
  listActiveRequestTypes,
  listRequestQueueForActor,
  transitionRequestStatusForActor,
} from "@/lib/domain/requests";
import { AppError } from "@/lib/errors";
import { parseInput } from "@/lib/validation/parse";
import {
  cancelRequestSchema,
  createRequestSchema,
  requestIdSchema,
  requestListQuerySchema,
  requestQueueQuerySchema,
  requestStatusTransitionSchema,
  type RequestListQuery,
  type RequestQueueQuery,
} from "@/lib/validation/requests";
import type { ActionResult } from "./result";
import { toActionError } from "./result";

/**
 * Server Actions заявок. `userId` и роль берутся только из проверенной
 * серверной сессии; клиентские идентификаторы игнорируются.
 */

export async function getRequestCatalog(): Promise<RequestCatalogItem[]> {
  const user = await requireUser();
  return user.role === "STUDENT" ? listActiveRequestTypes() : [];
}

export async function createRequest(input: unknown): Promise<ActionResult<RequestCreated>> {
  try {
    const user = await requireUser();

    if (user.role !== "STUDENT") {
      throw new AppError("FORBIDDEN");
    }

    const parsed = parseInput(createRequestSchema, input);
    const data = await createRequestForUser(user.id, parsed);

    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelRequest(requestId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();

    if (user.role !== "STUDENT") {
      throw new AppError("FORBIDDEN");
    }

    // Некорректный идентификатор неотличим от чужого: ответ нейтрален (§ 4.4).
    const parsed = cancelRequestSchema.safeParse({ requestId });

    if (!parsed.success) {
      throw new AppError("NOT_FOUND", { userMessage: "Заявка не найдена." });
    }

    await cancelRequestForUser(user.id, parsed.data.requestId);

    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function transitionRequestStatus(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const parsed = parseInput(requestStatusTransitionSchema, input);

    await transitionRequestStatusForActor({ userId: user.id, role: user.role }, parsed);

    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getMyRequests(filter?: RequestListQuery): Promise<RequestSummary[]> {
  const user = await requireUser();

  // Список «мои заявки» есть только у студента; сотруднику отдаём пустой
  // результат без раскрытия чужих данных и без ошибки (§ 4.4 не объявляет кодов).
  if (user.role !== "STUDENT") {
    return [];
  }

  const parsed = requestListQuerySchema.safeParse(filter ?? {});

  // Контракт действия не объявляет кодов ошибок: некорректный фильтр
  // деградирует в пустой список, не раскрывая данных и не бросая AppError.
  if (!parsed.success) {
    return [];
  }

  return getMyRequestsForUser(user.id, parsed.data);
}

export async function getRequest(requestId: string): Promise<RequestDetail | null> {
  const user = await requireUser();
  const parsed = requestIdSchema.safeParse(requestId);

  // Некорректный идентификатор — тот же нейтральный ответ, что и чужой (§ 4.5).
  if (!parsed.success) {
    return null;
  }

  return getRequestForActor({ userId: user.id, role: user.role }, parsed.data);
}

/**
 * Очередь заявок для сотрудника деканата. Роль проверяется в доменном слое;
 * студент получает `FORBIDDEN`, а не пустой список, потому что это действие
 * доступно только сотруднику по контракту `p4-requests.md`.
 */
export async function listRequestQueue(
  filter?: RequestQueueQuery,
): Promise<ActionResult<RequestQueueItem[]>> {
  try {
    const user = await requireUser();
    const parsed = parseInput(requestQueueQuerySchema, filter ?? {});
    const data = await listRequestQueueForActor({ userId: user.id, role: user.role }, parsed);

    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}
