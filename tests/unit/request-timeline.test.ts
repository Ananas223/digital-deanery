import { describe, expect, it } from "vitest";

import { buildRequestTimeline } from "@/lib/domain/request-timeline";

const CREATED_AT = new Date("2026-11-10T08:00:00.000Z");
const IN_PROGRESS_AT = new Date("2026-11-11T09:00:00.000Z");
const READY_AT = new Date("2026-11-12T10:00:00.000Z");
const REJECTED_AT = new Date("2026-11-12T11:00:00.000Z");
const CANCELLED_AT = new Date("2026-11-11T12:00:00.000Z");

const base = {
  number: "З-2026-000001",
  createdAt: CREATED_AT,
  rejectionReason: null,
};

describe("buildRequestTimeline", () => {
  it("показывает новую заявку как поданную и принятую", () => {
    const timeline = buildRequestTimeline({
      ...base,
      status: "NEW",
      history: [{ toStatus: "NEW", createdAt: CREATED_AT }],
    });

    expect(timeline.map((step) => step.label)).toEqual([
      "Подана",
      "Принята",
      "В работе",
      "Готова",
    ]);
    expect(timeline.map((step) => step.state)).toEqual([
      "done",
      "current",
      "upcoming",
      "upcoming",
    ]);
    expect(timeline[1]?.at).toEqual(CREATED_AT);
    expect(timeline[2]?.at).toBeNull();
    expect(timeline[3]?.at).toBeNull();
  });

  it("отмечает текущий этап в работе и известное время", () => {
    const timeline = buildRequestTimeline({
      ...base,
      status: "IN_PROGRESS",
      history: [
        { toStatus: "NEW", createdAt: CREATED_AT },
        { toStatus: "IN_PROGRESS", createdAt: IN_PROGRESS_AT },
      ],
    });

    expect(timeline.map((step) => step.state)).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
    ]);
    expect(timeline[2]?.at).toEqual(IN_PROGRESS_AT);
  });

  it("завершает маршрут готовой заявки", () => {
    const timeline = buildRequestTimeline({
      ...base,
      status: "READY",
      history: [
        { toStatus: "NEW", createdAt: CREATED_AT },
        { toStatus: "IN_PROGRESS", createdAt: IN_PROGRESS_AT },
        { toStatus: "READY", createdAt: READY_AT },
      ],
    });

    expect(timeline.map((step) => step.state)).toEqual(["done", "done", "done", "done"]);
    expect(timeline[3]?.at).toEqual(READY_AT);
  });

  it("заменяет готовность фактической веткой отказа", () => {
    const timeline = buildRequestTimeline({
      ...base,
      status: "REJECTED",
      rejectionReason: "Не указано место предоставления.",
      history: [
        { toStatus: "NEW", createdAt: CREATED_AT },
        { toStatus: "IN_PROGRESS", createdAt: IN_PROGRESS_AT },
        { toStatus: "REJECTED", createdAt: REJECTED_AT },
      ],
    });

    expect(timeline.map((step) => step.label)).toEqual([
      "Подана",
      "Принята",
      "В работе",
      "Отклонена",
    ]);
    expect(timeline[3]).toMatchObject({ state: "stopped", tone: "danger", at: REJECTED_AT });
    expect(timeline[3]?.description).toContain("Причина");
    expect(timeline.some((step) => step.label === "Готова")).toBe(false);
  });

  it("показывает отмену без недостижимых этапов", () => {
    const timeline = buildRequestTimeline({
      ...base,
      status: "CANCELLED",
      history: [
        { toStatus: "NEW", createdAt: CREATED_AT },
        { toStatus: "CANCELLED", createdAt: CANCELLED_AT },
      ],
    });

    expect(timeline.map((step) => step.label)).toEqual(["Подана", "Принята", "Отменена"]);
    expect(timeline[2]).toMatchObject({ state: "stopped", at: CANCELLED_AT });
    expect(timeline.some((step) => step.label === "Готова")).toBe(false);
  });

  it("не подставляет время вместо отсутствующего события", () => {
    const timeline = buildRequestTimeline({
      ...base,
      status: "IN_PROGRESS",
      history: [{ toStatus: "NEW", createdAt: CREATED_AT }],
    });

    expect(timeline[2]?.at).toBeNull();
  });
});
