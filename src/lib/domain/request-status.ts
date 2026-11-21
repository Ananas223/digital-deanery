import type { RequestStatus } from "@/generated/prisma/enums";

/** Подписи статусов заявки для списка и карточки. */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  READY: "Готова",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
};

/** Порядок статусов в фильтре и временной шкале. */
export const REQUEST_STATUS_ORDER: readonly RequestStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "READY",
  "REJECTED",
  "CANCELLED",
];

export type RequestActorRole = "STUDENT" | "DEAN_EMPLOYEE";

export type RequestTransitionActor = {
  role: RequestActorRole;
  /** Для студента важно только при отмене: действовать может лишь владелец. */
  isOwner: boolean;
};

const TERMINAL_STATUSES: readonly RequestStatus[] = ["READY", "REJECTED", "CANCELLED"];

export function isTerminalStatus(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Допустим ли переход с учётом роли и владения.
 *
 * Отклонение сразу из `NEW` запрещено: заявка сначала берётся в работу.
 * Терминальные статусы не меняются. Студент может только отменить свою
 * заявку в статусе `NEW`.
 */
export function canTransition(
  from: RequestStatus,
  to: RequestStatus,
  actor: RequestTransitionActor,
): boolean {
  if (isTerminalStatus(from) || from === to) {
    return false;
  }

  if (actor.role === "STUDENT") {
    return from === "NEW" && to === "CANCELLED" && actor.isOwner;
  }

  return (
    (from === "NEW" && to === "IN_PROGRESS") ||
    (from === "IN_PROGRESS" && (to === "READY" || to === "REJECTED"))
  );
}

/** Статусы, в которые актор может перевести заявку из текущего состояния. */
export function getAllowedTransitions(
  from: RequestStatus,
  actor: RequestTransitionActor,
): RequestStatus[] {
  return REQUEST_STATUS_ORDER.filter((to) => canTransition(from, to, actor));
}
