import type { RequestStatus } from "@/generated/prisma/enums";

/**
 * Тексты уведомлений о заявке — общий контракт с этапом 5 (`P5-BE-02`).
 *
 * Уведомление создаётся в той же транзакции, что и заявка или переход
 * статуса. Модуль чистый: не обращается к БД и не знает о сессии.
 */

export type RequestNotificationContent = {
  title: string;
  body: string;
  priority: "NORMAL" | "IMPORTANT";
};

export function buildRequestStatusNotification(
  status: RequestStatus,
  number: string,
): RequestNotificationContent {
  switch (status) {
    case "NEW":
      return {
        title: "Заявка создана",
        body: `Заявка ${number} создана и ожидает рассмотрения. Следите за статусом в карточке заявки.`,
        priority: "NORMAL",
      };
    case "IN_PROGRESS":
      return {
        title: "Заявка принята в работу",
        body: `Заявка ${number} принята в работу деканатом. Следите за статусом в карточке заявки.`,
        priority: "NORMAL",
      };
    case "READY":
      return {
        title: "Заявка готова",
        body: `По заявке ${number} подготовлен документ. Откройте карточку заявки, чтобы узнать порядок получения.`,
        priority: "IMPORTANT",
      };
    case "REJECTED":
      return {
        title: "Заявка отклонена",
        body: `Заявка ${number} отклонена. Причина указана в карточке заявки; там же можно создать новую заявку.`,
        priority: "IMPORTANT",
      };
    case "CANCELLED":
      return {
        title: "Заявка отменена",
        body: `Заявка ${number} отменена. История заявки сохранена в личном кабинете.`,
        priority: "NORMAL",
      };
  }
}

/** Ключ идемпотентности: одно событие истории — одно уведомление. */
export function getRequestStatusDedupeKey(requestId: string, historyId: string): string {
  return `request:${requestId}:status:${historyId}`;
}
