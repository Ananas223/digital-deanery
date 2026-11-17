"use server";

import { requireUser } from "@/lib/auth/session";
import type {
  RequestCreated,
  RequestDetail,
  RequestSummary,
} from "@/lib/domain/requests";
import {
  cancelRequestForUser,
  createRequestForUser,
  getMyRequests as getMyRequestsForUser,
  getRequest as getRequestForActor,
  transitionRequestStatusForActor,
} from "@/lib/domain/requests";
import { AppError } from "@/lib/errors";
import { parseInput } from "@/lib/validation/parse";
import {
  createRequestSchema,
  requestIdSchema,
  requestListQuerySchema,
  requestStatusTransitionSchema,
  type RequestListQuery,
} from "@/lib/validation/requests";
import type { ActionResult } from "./result";
import { toActionError } from "./result";

/**
 * Server Actions заявок. `userId` и роль берутся только из проверенной
 * серверной сессии; клиентские идентификаторы игнорируются.
 */

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

    const parsed = parseInput(requestIdSchema, requestId);
    await cancelRequestForUser(user.id, parsed);

    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function transitionRequestStatus(
  input: unknown,
): Promise<ActionResult<void>> {
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

  if (user.role !== "STUDENT") {
    throw new AppError("FORBIDDEN");
  }

  const parsed = filter ? parseInput(requestListQuerySchema, filter) : {};

  return getMyRequestsForUser(user.id, parsed);
}

export async function getRequest(requestId: string): Promise<RequestDetail | null> {
  const user = await requireUser();
  const parsed = parseInput(requestIdSchema, requestId);

  return getRequestForActor({ userId: user.id, role: user.role }, parsed);
}
