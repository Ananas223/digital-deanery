import { z } from "zod";

/**
 * Контракт ленты уведомлений (`docs/specs/p5-notifications.md` § 4.4).
 *
 * Фильтр и курсор проверяются на сервере повторно, независимо от клиента.
 */

export const NOTIFICATION_CATEGORIES = ["DEANERY", "SCHEDULE", "REQUESTS", "DEADLINES"] as const;

export const NOTIFICATION_FILTER_CATEGORIES = ["ALL", ...NOTIFICATION_CATEGORIES] as const;

export type NotificationCategoryValue = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationFilterCategory = (typeof NOTIFICATION_FILTER_CATEGORIES)[number];

/** Размер страницы ленты; пагинация идёт по `id`-курсору. */
export const NOTIFICATION_PAGE_SIZE = 20;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);

export const notificationFilterSchema = z.object({
  category: z.enum(NOTIFICATION_FILTER_CATEGORIES).default("ALL"),
});

export const notificationCursorSchema = z.cuid("Некорректный курсор ленты");

export const notificationIdSchema = z.cuid("Некорректный идентификатор уведомления");

export type NotificationFilter = z.infer<typeof notificationFilterSchema>;
