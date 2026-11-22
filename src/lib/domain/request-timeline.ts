import type { RequestStatus } from "@/generated/prisma/enums";

export type RequestTimelineState = "done" | "current" | "upcoming" | "stopped";

export type RequestTimelineStep = {
  key: "submitted" | "accepted" | "in_progress" | "ready" | "rejected" | "cancelled";
  label: string;
  description: string;
  at: Date | null;
  state: RequestTimelineState;
  tone: "neutral" | "danger";
};

type TimelineHistoryEntry = {
  toStatus: RequestStatus;
  createdAt: Date;
};

export type RequestTimelineInput = {
  number: string;
  status: RequestStatus;
  createdAt: Date;
  history: readonly TimelineHistoryEntry[];
  rejectionReason: string | null;
};

function historyAt(history: readonly TimelineHistoryEntry[], status: RequestStatus): Date | null {
  return history.find((entry) => entry.toStatus === status)?.createdAt ?? null;
}

/**
 * Человеческий маршрут заявки из уже сохранённых данных.
 *
 * Новых событий не придумываем: «Подана» — `createdAt`, «Принята» — присвоенный
 * номер, остальные этапы — записи истории переходов. Для отказа и отмены
 * показываем фактическую ветку, а не недостижимую «Готову».
 */
export function buildRequestTimeline(request: RequestTimelineInput): RequestTimelineStep[] {
  const acceptedAt = historyAt(request.history, "NEW") ?? request.createdAt;
  const inProgressAt = historyAt(request.history, "IN_PROGRESS");
  const readyAt = historyAt(request.history, "READY");
  const rejectedAt = historyAt(request.history, "REJECTED");
  const cancelledAt = historyAt(request.history, "CANCELLED");

  const steps: RequestTimelineStep[] = [
    {
      key: "submitted",
      label: "Подана",
      description: "Заявка отправлена в деканат.",
      at: request.createdAt,
      state: "done",
      tone: "neutral",
    },
    {
      key: "accepted",
      label: "Принята",
      description: `Зарегистрирована, номер ${request.number}.`,
      at: acceptedAt,
      state: request.status === "NEW" ? "current" : "done",
      tone: "neutral",
    },
  ];

  if (request.status === "CANCELLED") {
    steps.push({
      key: "cancelled",
      label: "Отменена",
      description: "Заявка отменена до начала обработки.",
      at: cancelledAt,
      state: "stopped",
      tone: "neutral",
    });

    return steps;
  }

  steps.push({
    key: "in_progress",
    label: "В работе",
    description:
      request.status === "REJECTED"
        ? "Деканат проверил обращение."
        : "Деканат обрабатывает обращение.",
    at: inProgressAt,
    state:
      request.status === "IN_PROGRESS" ? "current" : request.status === "NEW" ? "upcoming" : "done",
    tone: "neutral",
  });

  if (request.status === "REJECTED") {
    steps.push({
      key: "rejected",
      label: "Отклонена",
      description: request.rejectionReason
        ? "Причина указана в сообщении выше."
        : "Причина указана в истории обработки.",
      at: rejectedAt,
      state: "stopped",
      tone: "danger",
    });

    return steps;
  }

  steps.push({
    key: "ready",
    label: "Готова",
    description: "Документ готов. Заберите его в деканате.",
    at: readyAt,
    state: request.status === "READY" ? "done" : "upcoming",
    tone: "neutral",
  });

  return steps;
}
