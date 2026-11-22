import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAiTools } from "@/lib/ai/tools";

/**
 * Сбой доменного чтения внутри инструмента не должен раскрывать модель.
 *
 * AI SDK передаёт текст брошенной ошибки провайдеру и модели, поэтому каждый
 * инструмент обязан вернуть нейтральную заглушку `available: false`, а в лог —
 * только имя ошибки и идентификатор запроса.
 */

const failure = vi.hoisted(() => ({
  message: "db password and SQL leaked in the raw error",
}));

vi.mock("@/lib/domain/schedule", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/domain/schedule")>();

  return {
    ...actual,
    getTodaySchedule: async () => {
      throw new Error(failure.message);
    },
    getWeekSchedule: async () => {
      throw new Error(failure.message);
    },
  };
});

vi.mock("@/lib/domain/grades", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/domain/grades")>();

  return {
    ...actual,
    getSemesterOverview: async () => {
      throw new Error(failure.message);
    },
  };
});

vi.mock("@/lib/domain/requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/domain/requests")>();

  return {
    ...actual,
    getMyRequests: async () => {
      throw new Error(failure.message);
    },
    getActiveRequestsForUser: async () => {
      throw new Error(failure.message);
    },
    getRequest: async () => {
      throw new Error(failure.message);
    },
  };
});

vi.mock("@/lib/domain/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/domain/notifications")>();

  return {
    ...actual,
    getNotificationsForUser: async () => {
      throw new Error(failure.message);
    },
  };
});

const NOW = new Date("2026-11-19T09:00:00.000Z");
const TOOL_CALL = { toolCallId: "call-1", messages: [] };

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("нейтральный результат при сбое инструмента", () => {
  it("возвращает заглушку для каждого из пяти инструментов", async () => {
    const tools = createAiTools("student-1", NOW, { requestId: "request-1" });

    const schedule = await tools.getSchedule!.execute!({ range: "today" }, TOOL_CALL);
    const grades = await tools.getGrades!.execute!({}, TOOL_CALL);
    const requests = await tools.getRequests!.execute!({}, TOOL_CALL);
    const notifications = await tools.getNotifications!.execute!({}, TOOL_CALL);
    const upcoming = await tools.getUpcoming!.execute!({ days: 14 }, TOOL_CALL);

    expect(schedule).toEqual({
      available: false,
      range: "today",
      days: [],
      truncated: false,
    });
    expect(grades).toEqual({
      available: false,
      semester: null,
      summary: null,
      grades: [],
      upcomingExams: [],
      truncated: false,
    });
    expect(requests).toEqual({
      available: false,
      items: [],
      detail: null,
      truncated: false,
    });
    expect(notifications).toEqual({
      available: false,
      items: [],
      unreadCount: 0,
      truncated: false,
    });
    expect(upcoming).toEqual({
      available: false,
      horizonDays: 14,
      deadlines: [],
      changes: [],
      truncated: false,
    });

    expect(JSON.stringify({ schedule, grades, requests, notifications, upcoming })).not.toContain(
      failure.message,
    );
  });

  it("пишет в лог только событие, requestId и имя ошибки", async () => {
    const tools = createAiTools("student-1", NOW, { requestId: "request-1" });

    await tools.getGrades!.execute!({}, TOOL_CALL);

    expect(consoleError).toHaveBeenCalledTimes(1);

    const logged = String(consoleError.mock.calls[0]?.[0]);

    expect(logged).toContain('"event":"tool.failed"');
    expect(logged).toContain('"requestId":"request-1"');
    expect(logged).toContain('"errorName":"Error"');
    expect(logged).not.toContain(failure.message);
  });

  it("не логирует сбой без известного requestId", async () => {
    const tools = createAiTools("student-1", NOW);

    await tools.getNotifications!.execute!({}, TOOL_CALL);

    expect(consoleError).not.toHaveBeenCalled();
  });
});
