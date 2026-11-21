import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  NotificationCategory,
  NotificationPriority,
  NotificationSource,
  NotificationTarget,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import {
  buildNotificationAudienceWhere,
  isNotificationVisibleToStudent,
  type StudentNotificationAudience,
} from "@/lib/domain/notification-audience";
import { AppError } from "@/lib/errors";
import { NOTIFICATION_PAGE_SIZE, type NotificationFilter } from "@/lib/validation/notifications";

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  source: NotificationSource | null;
  priority: NotificationPriority;
  title: string;
  body: string;
  targetType: NotificationTarget;
  targetId: string | null;
  publishedAt: Date;
  isRead: boolean;
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
  /** Непрочитанные по всей доступной ленте, без учёта выбранной категории. */
  unreadCount: number;
};

export type MarkAllResult = {
  count: number;
};

export type UnreadNotifications = {
  /** Непрочитанные по всей доступной ленте, без учёта лимита. */
  count: number;
  /** Не более `limit`, важные сверху, затем новые. Все элементы непрочитаны. */
  items: NotificationItem[];
};

const notificationFields = {
  id: true,
  category: true,
  source: true,
  priority: true,
  title: true,
  body: true,
  targetType: true,
  targetId: true,
  publishedAt: true,
} satisfies Prisma.NotificationSelect;

/** Аудитория студента — из профиля, связанного с проверенной сессией. */
async function getStudentNotificationAudience(
  userId: string,
): Promise<StudentNotificationAudience | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true, groupId: true, facultyId: true },
  });

  if (!profile) {
    return null;
  }

  return {
    studentId: profile.id,
    groupId: profile.groupId,
    facultyId: profile.facultyId,
  };
}

function buildFeedWhere(
  student: StudentNotificationAudience,
  filter: NotificationFilter,
  now: Date,
): Prisma.NotificationWhereInput {
  return {
    ...buildNotificationAudienceWhere(student, now, filter.scope),
    ...(filter.category === "ALL" ? {} : { category: filter.category }),
  };
}

function unreadWhere(
  student: StudentNotificationAudience,
  userId: string,
  now: Date,
): Prisma.NotificationWhereInput {
  return {
    ...buildNotificationAudienceWhere(student, now),
    reads: { none: { userId } },
  };
}

function toItem(
  row: Prisma.NotificationGetPayload<{
    select: typeof notificationFields & { reads: { select: { id: true } } };
  }>,
): NotificationItem {
  return {
    id: row.id,
    category: row.category,
    source: row.source,
    priority: row.priority,
    title: row.title,
    body: row.body,
    targetType: row.targetType,
    targetId: row.targetId,
    publishedAt: row.publishedAt,
    isRead: row.reads.length > 0,
  };
}

/**
 * Лента доступных студенту уведомлений: важные сверху, затем новые.
 *
 * Страница ограничена `NOTIFICATION_PAGE_SIZE`; `nextCursor` — `id`
 * последнего элемента. Истёкшие уведомления доступны в архиве, вне счётчика.
 */
export async function getNotificationsForUser(
  userId: string,
  filter: NotificationFilter,
  cursor?: string,
  now: Date = new Date(),
): Promise<NotificationPage> {
  const student = await getStudentNotificationAudience(userId);

  if (!student) {
    return { items: [], nextCursor: null, unreadCount: 0 };
  }

  const where = buildFeedWhere(student, filter, now);

  const [rows, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: [{ priority: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
      take: NOTIFICATION_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        ...notificationFields,
        reads: { where: { userId }, select: { id: true } },
      },
    }),
    prisma.notification.count({ where: unreadWhere(student, userId, now) }),
  ]);

  const hasMore = rows.length > NOTIFICATION_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, NOTIFICATION_PAGE_SIZE) : rows;

  return {
    items: pageRows.map(toItem),
    nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
    unreadCount,
  };
}

/** Счётчик непрочитанных для навигации и главного экрана. */
export async function getUnreadCountForUser(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const student = await getStudentNotificationAudience(userId);

  if (!student) {
    return 0;
  }

  return prisma.notification.count({ where: unreadWhere(student, userId, now) });
}

/** Лимит превью непрочитанных по умолчанию (главный экран: до трёх элементов). */
export const UNREAD_PREVIEW_DEFAULT_LIMIT = 3;
/** Верхняя граница превью: защищает главный экран от случайного большого лимита. */
const UNREAD_PREVIEW_MAX_LIMIT = 20;

/** Приводит лимит превью к целому числу в диапазоне `1..20`; нечисло — значение по умолчанию. */
function normalizeUnreadLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return UNREAD_PREVIEW_DEFAULT_LIMIT;
  }

  return Math.min(UNREAD_PREVIEW_MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

/**
 * Непрочитанные уведомления для главного экрана: `count` — по всей доступной
 * ленте, `items` — не более `limit` важных и новых.
 *
 * `limit` приводится к диапазону `1..20` (дробное округляется вниз, нечисло
 * даёт значение по умолчанию 3). Без академического профиля возвращается
 * пустой результат, а не ошибка. Персональные данные не кешируются.
 */
export async function getUnreadNotificationsForUser(
  userId: string,
  limit = UNREAD_PREVIEW_DEFAULT_LIMIT,
  now: Date = new Date(),
): Promise<UnreadNotifications> {
  const student = await getStudentNotificationAudience(userId);

  if (!student) {
    return { count: 0, items: [] };
  }

  const where = unreadWhere(student, userId, now);

  const [rows, count] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: [{ priority: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
      take: normalizeUnreadLimit(limit),
      select: notificationFields,
    }),
    prisma.notification.count({ where }),
  ]);

  // Выборка уже ограничена непрочитанными: дополнительный запрос отметок не нужен.
  return { count, items: rows.map((row) => ({ ...row, isRead: false })) };
}

/**
 * Отмечает одно уведомление прочитанным. Повторный вызов идемпотентен:
 * первая отметка сохраняется, дубль не создаётся.
 *
 * Чужое или несуществующее уведомление одинаково возвращает `NOT_FOUND`,
 * чтобы не раскрывать наличие записи.
 */
export async function markNotificationReadForUser(
  userId: string,
  notificationId: string,
  now: Date = new Date(),
): Promise<void> {
  const student = await getStudentNotificationAudience(userId);

  if (!student) {
    throw new AppError("NOT_FOUND", { userMessage: "Уведомление не найдено." });
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      audienceType: true,
      audienceStudentId: true,
      audienceGroupId: true,
      audienceFacultyId: true,
    },
  });

  if (!notification || !isNotificationVisibleToStudent(notification, student)) {
    throw new AppError("NOT_FOUND", { userMessage: "Уведомление не найдено." });
  }

  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    update: {},
    create: { notificationId, userId, readAt: now },
  });
}

/**
 * Отмечает прочитанными все доступные уведомления студента.
 *
 * Возвращает число новых отметок. Повторный вызов ничего не добавляет
 * и возвращает `0`; гонка с параллельной отметкой разрешается уникальным
 * индексом и `skipDuplicates`.
 */
export async function markAllNotificationsReadForUser(
  userId: string,
  now: Date = new Date(),
): Promise<MarkAllResult> {
  const student = await getStudentNotificationAudience(userId);

  if (!student) {
    return { count: 0 };
  }

  const unread = await prisma.notification.findMany({
    where: unreadWhere(student, userId, now),
    select: { id: true },
  });

  if (unread.length === 0) {
    return { count: 0 };
  }

  const created = await prisma.notificationRead.createMany({
    data: unread.map((notification) => ({
      notificationId: notification.id,
      userId,
      readAt: now,
    })),
    skipDuplicates: true,
  });

  return { count: created.count };
}
