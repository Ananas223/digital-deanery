import type { Route } from "next";

import type { NotificationSource } from "@/generated/prisma/enums";
import type { NotificationItem } from "@/lib/domain/notifications";
import type { NotificationFilterCategory, NotificationScope } from "@/lib/validation/notifications";

export const NOTIFICATION_LABELS: Record<NotificationFilterCategory, string> = {
  ALL: "Все",
  DEANERY: "Деканат",
  SCHEDULE: "Расписание",
  REQUESTS: "Заявки",
  DEADLINES: "Дедлайны",
};

export const NOTIFICATION_SOURCE_LABELS: Record<NotificationSource, string> = {
  DEANERY: "Деканат",
  SCHEDULE_SYSTEM: "Система расписания",
  REQUESTS_SYSTEM: "Система заявок",
  ACADEMIC_CALENDAR: "Учебный календарь",
};

export function notificationFeedHref(
  scope: NotificationScope,
  category: NotificationFilterCategory,
): Route {
  const query = new URLSearchParams();
  if (scope === "ARCHIVE") query.set("scope", scope);
  if (category !== "ALL") query.set("category", category);
  return query.size ? (`/notifications?${query}` as Route) : "/notifications";
}

const SECTIONS = {
  schedule: { href: "/schedule", label: "Открыть расписание" },
  grades: { href: "/grades", label: "Открыть успеваемость" },
  requests: { href: "/requests", label: "Открыть заявки" },
  notifications: { href: "/notifications", label: "Открыть уведомления" },
} as const;

/** Builds destinations from known routes, never from an unchecked URL. */
export function notificationDestination(
  item: Pick<NotificationItem, "targetType" | "targetId">,
): { href: Route; label: string } | null {
  if (item.targetType === "REQUEST" && item.targetId) {
    return {
      href: `/requests/${encodeURIComponent(item.targetId)}` as Route,
      label: "Открыть заявку",
    };
  }

  if (item.targetType === "LESSON" && item.targetId) {
    return {
      href: `/schedule/${encodeURIComponent(item.targetId)}` as Route,
      label: "Открыть занятие",
    };
  }

  if (item.targetType === "SECTION" && item.targetId) {
    const section = item.targetId.replace(/^\//, "");
    return Object.hasOwn(SECTIONS, section) ? SECTIONS[section as keyof typeof SECTIONS] : null;
  }

  return null;
}
