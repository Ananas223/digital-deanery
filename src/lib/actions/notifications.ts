"use server";

import { requireUser } from "@/lib/auth/session";
import {
  getNotificationsForUser,
  getUnreadCountForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  type MarkAllResult,
  type NotificationPage,
} from "@/lib/domain/notifications";
import { AppError } from "@/lib/errors";
import { parseInput } from "@/lib/validation/parse";
import {
  notificationCursorSchema,
  notificationFilterSchema,
  notificationIdSchema,
  type NotificationFilter,
} from "@/lib/validation/notifications";
import type { ActionResult } from "./result";
import { toActionError } from "./result";

/**
 * Server Actions уведомлений. `userId` и роль берутся только из проверенной
 * сессии; студент видит ленту своей аудитории, сотрудник — нет.
 */

export async function getNotifications(
  filter: NotificationFilter,
  cursor?: string,
): Promise<NotificationPage> {
  const user = await requireUser();

  if (user.role !== "STUDENT") {
    return { items: [], nextCursor: null, unreadCount: 0 };
  }

  const parsedFilter = parseInput(notificationFilterSchema, filter);
  const parsedCursor =
    cursor === undefined ? undefined : parseInput(notificationCursorSchema, cursor);

  return getNotificationsForUser(user.id, parsedFilter, parsedCursor);
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();

  if (user.role !== "STUDENT") {
    return 0;
  }

  return getUnreadCountForUser(user.id);
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();

    if (user.role !== "STUDENT") {
      throw new AppError("FORBIDDEN");
    }

    // Некорректный идентификатор неотличим от чужого: ответ нейтрален (§ 4.5).
    const parsed = notificationIdSchema.safeParse(notificationId);

    if (!parsed.success) {
      throw new AppError("NOT_FOUND", { userMessage: "Уведомление не найдено." });
    }

    await markNotificationReadForUser(user.id, parsed.data);

    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult<MarkAllResult>> {
  try {
    const user = await requireUser();

    if (user.role !== "STUDENT") {
      throw new AppError("FORBIDDEN");
    }

    const data = await markAllNotificationsReadForUser(user.id);

    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}
