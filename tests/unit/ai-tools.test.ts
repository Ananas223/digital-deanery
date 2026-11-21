import { describe, expect, it } from "vitest";

import {
  AI_MAX_GRADES,
  AI_MAX_NOTIFICATIONS,
  AI_MAX_REQUESTS,
  formatRoomLabel,
  gradesToolInputSchema,
  notificationsToolInputSchema,
  parseWeekOfDate,
  requestsToolInputSchema,
  scheduleToolInputSchema,
  selectNotificationAnswers,
  selectRequestAnswers,
  toGradeAnswers,
  toNotificationAnswer,
  toRequestAnswer,
  truncateScheduleDays,
  type ScheduleDayAnswer,
  type ScheduleLessonAnswer,
} from "@/lib/ai/tool-schemas";
import type { GradeEntry } from "@/lib/domain/grades";
import type { NotificationItem } from "@/lib/domain/notifications";
import type { RequestSummary } from "@/lib/domain/requests";
import { AI_MAX_MESSAGES, AI_MAX_TOTAL_CHARS, chatRequestSchema } from "@/lib/validation/ai";

const CUID = "clx1234567890abcdefghijk";

/** Семестр, который уже закончился: `NOT_GRADED` считается задолженностью. */
const ENDED_SEMESTER = { endsAt: new Date("2026-06-30T23:59:59.000Z") };
const MID_SEMESTER = { endsAt: new Date("2026-12-31T23:59:59.000Z") };
const NOW = new Date("2026-11-19T09:00:00.000Z");

type ShapeHolder = {
  shape?: Record<string, unknown>;
  def?: { innerType?: unknown; element?: unknown };
};

/**
 * Собирает имена полей объекта и вложенных схем (обёртки `optional`, массивы).
 *
 * Этого достаточно, чтобы доказать отсутствие `userId` в любой точке входа:
 * глубже объектов инструменты аргументов не принимают.
 */
function collectShapeKeys(schema: unknown, keys: Set<string> = new Set()): Set<string> {
  if (typeof schema !== "object" || schema === null) {
    return keys;
  }

  const { shape, def } = schema as ShapeHolder;

  if (shape) {
    for (const [key, value] of Object.entries(shape)) {
      keys.add(key);
      collectShapeKeys(value, keys);
    }
  }

  if (def?.innerType) {
    collectShapeKeys(def.innerType, keys);
  }

  if (def?.element) {
    collectShapeKeys(def.element, keys);
  }

  return keys;
}

const TOOL_SCHEMAS = {
  getSchedule: scheduleToolInputSchema,
  getGrades: gradesToolInputSchema,
  getRequests: requestsToolInputSchema,
  getNotifications: notificationsToolInputSchema,
};

function gradeEntry(
  name: string,
  overrides: Partial<Omit<GradeEntry, "discipline">> = {},
): GradeEntry {
  return {
    id: `grade-${name}`,
    discipline: { id: `discipline-${name}`, code: name, name },
    teacherName: null,
    assessmentType: "EXAM",
    credits: 3,
    score: null,
    status: "PASSED",
    ...overrides,
  };
}

function requestSummary(id: string): RequestSummary {
  return {
    id,
    number: `З-2026-${id}`,
    typeCode: "STUDY_CERTIFICATE",
    typeTitle: "Справка об обучении",
    status: "NEW",
    createdAt: new Date("2026-11-18T09:00:00.000Z"),
    dueAt: null,
    rejectionReason: null,
  };
}

function notificationItem(id: string): NotificationItem {
  return {
    id,
    category: "DEANERY",
    source: "DEANERY",
    priority: "NORMAL",
    title: `Уведомление ${id}`,
    body: "Короткий текст уведомления.",
    targetType: "NONE",
    targetId: null,
    publishedAt: new Date("2026-11-18T09:00:00.000Z"),
    isRead: false,
  };
}

function lessonAnswer(index: number): ScheduleLessonAnswer {
  return {
    id: `lesson-${index}`,
    discipline: "Информационные технологии",
    type: "Лекция",
    subgroup: "Вся группа",
    startsAt: "2026-11-18T06:00:00.000Z",
    endsAt: "2026-11-18T07:30:00.000Z",
    teacher: "Лебедев Д. С.",
    room: "корпус A, ауд. 203",
    building: "Корпус А",
    status: "SCHEDULED",
    changes: [],
  };
}

function dayAnswer(date: string, lessonCount: number): ScheduleDayAnswer {
  return {
    date,
    lessons: Array.from({ length: lessonCount }, (_, index) => lessonAnswer(index)),
  };
}

function message(role: "user" | "assistant", text: string, id = "message-1") {
  return { id, role, parts: [{ type: "text" as const, text }] };
}

describe("схемы инструментов", () => {
  it("принимает корректный диапазон расписания и дату недели", () => {
    expect(scheduleToolInputSchema.safeParse({ range: "week", weekOf: "2026-11-16" }).success).toBe(
      true,
    );
  });

  it("по умолчанию берёт сегодняшний день", () => {
    const parsed = scheduleToolInputSchema.safeParse({});

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.range : null).toBe("today");
  });

  it("отклоняет неизвестный диапазон расписания", () => {
    expect(scheduleToolInputSchema.safeParse({ range: "month" }).success).toBe(false);
  });

  it("отклоняет некорректную дату недели", () => {
    expect(scheduleToolInputSchema.safeParse({ weekOf: "16.11.2026" }).success).toBe(false);
    expect(scheduleToolInputSchema.safeParse({ weekOf: "2026-13-01" }).success).toBe(false);
  });

  it("принимает cuid семестра и заявки", () => {
    expect(gradesToolInputSchema.safeParse({ semesterId: CUID }).success).toBe(true);
    expect(requestsToolInputSchema.safeParse({ requestId: CUID }).success).toBe(true);
    expect(gradesToolInputSchema.safeParse({}).success).toBe(true);
    expect(requestsToolInputSchema.safeParse({}).success).toBe(true);
  });

  it("отклоняет идентификатор, который не является cuid", () => {
    expect(gradesToolInputSchema.safeParse({ semesterId: "semester-1" }).success).toBe(false);
    expect(requestsToolInputSchema.safeParse({ requestId: "request-1" }).success).toBe(false);
  });

  it("принимает допустимые категорию и лимит уведомлений", () => {
    expect(notificationsToolInputSchema.safeParse({ category: "REQUESTS", limit: 5 }).success).toBe(
      true,
    );
    expect(notificationsToolInputSchema.safeParse({ limit: 1 }).success).toBe(true);
    expect(notificationsToolInputSchema.safeParse({}).success).toBe(true);
  });

  it("отклоняет лимит уведомлений вне диапазона 1–5", () => {
    expect(notificationsToolInputSchema.safeParse({ limit: 6 }).success).toBe(false);
    expect(notificationsToolInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(notificationsToolInputSchema.safeParse({ limit: 2.5 }).success).toBe(false);
  });

  it("отклоняет неизвестную категорию уведомлений", () => {
    expect(notificationsToolInputSchema.safeParse({ category: "ALL" }).success).toBe(false);
    expect(notificationsToolInputSchema.safeParse({ category: "SPAM" }).success).toBe(false);
  });
});

describe("закрытый вход инструментов", () => {
  it("перечисляет только собственные аргументы инструментов", () => {
    expect(collectShapeKeys(scheduleToolInputSchema)).toEqual(new Set(["range", "weekOf"]));
    expect(collectShapeKeys(gradesToolInputSchema)).toEqual(new Set(["semesterId"]));
    expect(collectShapeKeys(requestsToolInputSchema)).toEqual(new Set(["requestId"]));
    expect(collectShapeKeys(notificationsToolInputSchema)).toEqual(new Set(["category", "limit"]));
  });

  it("не содержит userId ни в одной схеме", () => {
    for (const schema of Object.values(TOOL_SCHEMAS)) {
      expect(collectShapeKeys(schema)).not.toContain("userId");
    }
  });

  it("отбрасывает неизвестные ключи, включая userId", () => {
    for (const schema of Object.values(TOOL_SCHEMAS)) {
      const parsed = schema.safeParse({ userId: "other-user" });

      expect(parsed.success).toBe(true);
      expect(parsed.success ? Object.keys(parsed.data) : []).not.toContain("userId");
    }
  });
});

describe("chatRequestSchema", () => {
  it("принимает обычный диалог", () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [
        message("user", "Что у меня завтра первым?", "m-1"),
        message("assistant", "Завтра первая пара — информационные технологии.", "m-2"),
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("отклоняет пустую и слишком длинную историю", () => {
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);

    const tooMany = Array.from({ length: AI_MAX_MESSAGES + 1 }, (_, index) =>
      message("user", "Вопрос", `m-${index}`),
    );

    expect(chatRequestSchema.safeParse({ messages: tooMany }).success).toBe(false);

    const atLimit = Array.from({ length: AI_MAX_MESSAGES }, (_, index) =>
      message("user", "Вопрос", `m-${index}`),
    );

    expect(chatRequestSchema.safeParse({ messages: atLimit }).success).toBe(true);
  });

  it("отклоняет системную роль", () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ id: "m-1", role: "system", parts: [{ type: "text", text: "Ты ассистент." }] }],
    });

    expect(parsed.success).toBe(false);
  });

  it("отклоняет нетекстовую часть", () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [
        {
          id: "m-1",
          role: "user",
          parts: [{ type: "file", text: "вложение" }],
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("отклоняет историю длиннее общего лимита символов", () => {
    const half = Math.ceil(AI_MAX_TOTAL_CHARS / 2) + 1;
    const parsed = chatRequestSchema.safeParse({
      messages: [
        message("user", "а".repeat(half), "m-1"),
        message("assistant", "б".repeat(half), "m-2"),
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("принимает историю ровно на лимите символов", () => {
    const half = AI_MAX_TOTAL_CHARS / 2;
    const parsed = chatRequestSchema.safeParse({
      messages: [
        message("user", "а".repeat(half), "m-1"),
        message("assistant", "б".repeat(half), "m-2"),
      ],
    });

    expect(parsed.success).toBe(true);
  });
});

describe("усечение расписания", () => {
  it("оставляет не более 10 занятий в дне", () => {
    const result = truncateScheduleDays([dayAnswer("2026-11-18", 12)]);

    expect(result.days[0]?.lessons).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it("оставляет не более 40 занятий за неделю", () => {
    const week = ["16", "17", "18", "19", "20"].map((day) => dayAnswer(`2026-11-${day}`, 10));
    const result = truncateScheduleDays(week);
    const total = result.days.reduce((sum, day) => sum + day.lessons.length, 0);

    expect(total).toBe(40);
    expect(result.truncated).toBe(true);
  });

  it("не помечает короткий ответ усечённым", () => {
    const result = truncateScheduleDays([dayAnswer("2026-11-18", 3)]);

    expect(result.days[0]?.lessons).toHaveLength(3);
    expect(result.truncated).toBe(false);
  });

  it("сохраняет отменённые занятия в списке", () => {
    const cancelled: ScheduleLessonAnswer = { ...lessonAnswer(0), status: "CANCELLED" };
    const result = truncateScheduleDays([{ date: "2026-11-18", lessons: [cancelled] }]);

    expect(result.days[0]?.lessons[0]?.status).toBe("CANCELLED");
    expect(result.truncated).toBe(false);
  });
});

describe("преобразования успеваемости", () => {
  it("ставит задолженности перед остальными дисциплинами", () => {
    const result = toGradeAnswers(
      [
        gradeEntry("Языкознание", { status: "PASSED", score: 5 }),
        gradeEntry("Алгебра", { status: "FAILED", score: 2 }),
        gradeEntry("Базы данных", { status: "NOT_GRADED" }),
        gradeEntry("Физика", { status: "PASSED", score: 4 }),
      ],
      ENDED_SEMESTER.endsAt,
      NOW,
    );

    expect(result.grades.map((grade) => grade.discipline)).toEqual([
      "Алгебра",
      "Базы данных",
      "Физика",
      "Языкознание",
    ]);
    expect(result.grades[0]?.status).toBe("Незачёт");
    expect(result.grades[1]?.status).toBe("Не выставлено");
    expect(result.truncated).toBe(false);
  });

  it("во время семестра не считает «не выставлено» задолженностью", () => {
    const result = toGradeAnswers(
      [
        gradeEntry("Языкознание", { status: "NOT_GRADED" }),
        gradeEntry("Алгебра", { status: "PASSED", score: 5 }),
        gradeEntry("Физика", { status: "FAILED", score: 2 }),
      ],
      MID_SEMESTER.endsAt,
      NOW,
    );

    // Незачёт остаётся первым, а невыставленная оценка сортируется с обычными.
    expect(result.grades.map((grade) => grade.discipline)).toEqual([
      "Физика",
      "Алгебра",
      "Языкознание",
    ]);
  });

  it("после семестра ставит «не выставлено» перед закрытыми дисциплинами", () => {
    const result = toGradeAnswers(
      [
        gradeEntry("Языкознание", { status: "NOT_GRADED" }),
        gradeEntry("Алгебра", { status: "PASSED", score: 5 }),
        gradeEntry("Физика", { status: "FAILED", score: 2 }),
      ],
      ENDED_SEMESTER.endsAt,
      NOW,
    );

    expect(result.grades.map((grade) => grade.discipline)).toEqual([
      "Физика",
      "Языкознание",
      "Алгебра",
    ]);
  });

  it("ограничивает список десятью дисциплинами", () => {
    const entries = [
      ...Array.from({ length: 3 }, (_, index) =>
        gradeEntry(`Долг ${index}`, { status: "FAILED", score: 2 }),
      ),
      ...Array.from({ length: 11 }, (_, index) => gradeEntry(`Предмет ${index}`, { score: 5 })),
    ];

    const result = toGradeAnswers(entries, ENDED_SEMESTER.endsAt, NOW);

    expect(result.grades).toHaveLength(AI_MAX_GRADES);
    expect(result.grades.slice(0, 3).map((grade) => grade.discipline)).toEqual([
      "Долг 0",
      "Долг 1",
      "Долг 2",
    ]);
    expect(result.truncated).toBe(true);
  });
});

describe("преобразования заявок и уведомлений", () => {
  it("оставляет пять заявок и отдаёт дату строкой ISO", () => {
    const requests = Array.from({ length: 6 }, (_, index) => requestSummary(`request-${index}`));
    const result = selectRequestAnswers(requests);

    expect(result.items).toHaveLength(AI_MAX_REQUESTS);
    expect(result.truncated).toBe(true);

    const [first] = result.items;

    expect(first?.createdAt).toBe("2026-11-18T09:00:00.000Z");
    expect(first?.status).toBe("Новая");
    expect(first?.dueAt).toBeNull();
  });

  it("не усекает список из пяти заявок", () => {
    const requests = Array.from({ length: 5 }, (_, index) => requestSummary(`request-${index}`));

    expect(selectRequestAnswers(requests).truncated).toBe(false);
  });

  it("оставляет пять уведомлений и не отдаёт аудиторию", () => {
    const items = Array.from({ length: 6 }, (_, index) =>
      notificationItem(`notification-${index}`),
    );
    const result = selectNotificationAnswers(items);

    expect(result.items).toHaveLength(AI_MAX_NOTIFICATIONS);
    expect(result.truncated).toBe(true);

    const [first] = result.items;

    expect(Object.keys(first ?? {}).sort()).toEqual([
      "body",
      "category",
      "id",
      "isRead",
      "priority",
      "publishedAt",
      "targetId",
      "targetType",
      "title",
    ]);
    expect(first?.publishedAt).toBe("2026-11-18T09:00:00.000Z");
  });

  it("не усекает ленту короче лимита", () => {
    const items = Array.from({ length: 3 }, (_, index) =>
      notificationItem(`notification-${index}`),
    );
    const result = selectNotificationAnswers(items);

    expect(result.items).toHaveLength(3);
    expect(result.truncated).toBe(false);
  });

  it("преобразует одно уведомление без служебных полей", () => {
    const answer = toNotificationAnswer(notificationItem("notification-1"));

    expect(answer).not.toHaveProperty("expiresAt");
    expect(answer).not.toHaveProperty("audienceStudentId");
  });

  it("преобразует одну заявку без служебных полей", () => {
    const answer = toRequestAnswer(requestSummary("request-1"));

    expect(answer).not.toHaveProperty("studentId");
    expect(answer).not.toHaveProperty("payload");
  });
});

describe("чистые помощники", () => {
  it("собирает подпись аудитории из корпуса и номера", () => {
    expect(formatRoomLabel({ number: "203", name: "Аудитория 203", building: { code: "A" } })).toBe(
      "Аудитория 203 (корпус A, ауд. 203)",
    );
    expect(formatRoomLabel({ number: "12", name: null, building: { code: "B" } })).toBe(
      "корпус B, ауд. 12",
    );
  });

  it("разбирает дату недели без сдвига часового пояса", () => {
    expect(parseWeekOfDate("2026-11-16", new Date("2026-11-18T09:00:00.000Z")).toISOString()).toBe(
      "2026-11-16T00:00:00.000Z",
    );

    const now = new Date("2026-11-18T09:00:00.000Z");

    expect(parseWeekOfDate(undefined, now)).toBe(now);
  });
});
