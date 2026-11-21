import type { Route } from "next";

import type { NotificationItem } from "@/lib/domain/notifications";
import type { NotificationFilterCategory } from "@/lib/validation/notifications";

export const NOTIFICATION_LABELS: Record<NotificationFilterCategory, string> = {
  ALL: "Все",
  DEANERY: "Деканат",
  SCHEDULE: "Расписание",
  REQUESTS: "Заявки",
  DEADLINES: "Дедлайны",
};

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
