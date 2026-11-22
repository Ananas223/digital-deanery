import "server-only";

import { tool, type ToolSet } from "ai";

import { getSemesterOverview } from "@/lib/domain/grades";
import { getNotificationsForUser } from "@/lib/domain/notifications";
import { getActiveRequestsForUser, getMyRequests, getRequest } from "@/lib/domain/requests";
import { getTodaySchedule, getWeekSchedule } from "@/lib/domain/schedule";

import { logAiError } from "./observability";
import {
  AI_MAX_NOTIFICATIONS,
  AI_MAX_REQUESTS,
  gradesToolInputSchema,
  notificationsToolInputSchema,
  parseWeekOfDate,
  requestsToolInputSchema,
  scheduleToolInputSchema,
  selectNotificationAnswers,
  selectRequestAnswers,
  toGradeAnswers,
  toRequestAnswer,
  toRequestDetailAnswer,
  toScheduleDayAnswer,
  toSemesterAnswer,
  toUpcomingChangeAnswers,
  toUpcomingDeadlineAnswers,
  toUpcomingExamAnswers,
  truncateScheduleDays,
  upcomingToolInputSchema,
  type GradesAnswer,
  type NotificationsAnswer,
  type NotificationsToolInput,
  type RequestsAnswer,
  type ScheduleAnswer,
  type ScheduleRange,
  type UpcomingAnswer,
} from "./tool-schemas";

/**
 * Read-only инструменты ИИ-помощника (`docs/specs/p9-ai-assistant.md` § 4.4,
 * `docs/adr/0005-ai-assistant.md`).
 *
 * Список закрыт: расширение — изменение спецификации. Инструменты — тонкие
 * обёртки над доменными читателями, прямой Prisma здесь нет. `userId` берётся
 * из проверенной серверной сессии и замыкается в функциях: ни в одной схеме и
 * ни в одном описании он не появляется, поэтому модель и текст студента не
 * могут выбрать чужого владельца данных.
 */

/** Закрытый список инструментов помощника. */
export const AI_TOOL_NAMES = Object.freeze([
  "getSchedule",
  "getGrades",
  "getRequests",
  "getNotifications",
  "getUpcoming",
] as const);

export type AiToolName = (typeof AI_TOOL_NAMES)[number];

export type AiToolContext = {
  /** Идентификатор запроса для серверного лога; в результат не попадает. */
  requestId?: string;
};

/**
 * Выполняет чтение инструмента и превращает любой сбой в нейтральный результат.
 *
 * AI SDK передаёт текст брошенной ошибки модели и провайдеру, поэтому наружу
 * уходит только заранее заданная заглушка `available: false`. В лог попадают
 * лишь имя ошибки и идентификатор запроса; сообщение, стек, SQL и данные
 * студента не сохраняются.
 */
async function runTool<T>(
  context: AiToolContext | undefined,
  fallback: T,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (context?.requestId) {
      logAiError("tool.failed", {
        requestId: context.requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }

    return fallback;
  }
}

async function buildScheduleAnswer(
  userId: string,
  range: ScheduleRange,
  weekOf: string | undefined,
  now: Date,
): Promise<ScheduleAnswer> {
  if (range === "today") {
    const day = await getTodaySchedule(userId, now);

    if (!day) {
      return { available: false, range, days: [], truncated: false };
    }

    const limited = truncateScheduleDays([toScheduleDayAnswer(day)]);

    return {
      available: true,
      range,
      date: day.date,
      days: limited.days,
      truncated: limited.truncated,
    };
  }

  const week = await getWeekSchedule(userId, parseWeekOfDate(weekOf, now));

  if (!week) {
    return { available: false, range, days: [], truncated: false };
  }

  const limited = truncateScheduleDays(week.days.map(toScheduleDayAnswer));

  return {
    available: true,
    range,
    weekStart: week.weekStart,
    weekNumber: week.weekNumber,
    days: limited.days,
    truncated: limited.truncated,
  };
}

async function buildGradesAnswer(
  userId: string,
  semesterId: string | undefined,
  now: Date,
): Promise<GradesAnswer> {
  const overview = await getSemesterOverview(userId, semesterId, now);

  if (!overview) {
    return {
      available: false,
      semester: null,
      summary: null,
      grades: [],
      upcomingExams: [],
      truncated: false,
    };
  }

  const gradeLimit = toGradeAnswers(overview.grades, overview.semester.endsAt, now);
  const examLimit = toUpcomingExamAnswers(overview.session, now);

  return {
    available: true,
    semester: toSemesterAnswer(overview.semester),
    summary: overview.summary,
    grades: gradeLimit.grades,
    upcomingExams: examLimit.exams,
    truncated: gradeLimit.truncated || examLimit.truncated,
  };
}

async function buildRequestsAnswer(
  userId: string,
  requestId: string | undefined,
): Promise<RequestsAnswer> {
  if (requestId) {
    // Роль фиксирована сервером: помощник доступен только студенту.
    const detail = await getRequest({ userId, role: "STUDENT" }, requestId);

    // Чужая или несуществующая заявка одинаково дают `null` без раскрытия факта.
    return {
      available: true,
      items: detail ? [toRequestAnswer(detail)] : [],
      detail: detail ? toRequestDetailAnswer(detail) : null,
      truncated: false,
    };
  }

  const requests = await getMyRequests(userId);
  const limited = selectRequestAnswers(requests, AI_MAX_REQUESTS);

  return {
    available: true,
    items: limited.items,
    detail: null,
    truncated: limited.truncated,
  };
}

async function buildNotificationsAnswer(
  userId: string,
  category: NotificationsToolInput["category"],
  limit: number | undefined,
  now: Date,
): Promise<NotificationsAnswer> {
  const page = await getNotificationsForUser(
    userId,
    { category: category ?? "ALL" },
    undefined,
    now,
  );
  const limited = selectNotificationAnswers(page.items, limit ?? AI_MAX_NOTIFICATIONS);

  return {
    available: true,
    items: limited.items,
    unreadCount: page.unreadCount,
    truncated: limited.truncated,
  };
}

async function buildUpcomingAnswer(
  userId: string,
  days: number,
  now: Date,
): Promise<UpcomingAnswer> {
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [overview, requests, notifications, currentWeek, followingWeek] = await Promise.all([
    getSemesterOverview(userId, undefined, now),
    getActiveRequestsForUser(userId),
    getNotificationsForUser(userId, { category: "DEADLINES" }, undefined, now),
    getWeekSchedule(userId, now),
    getWeekSchedule(userId, nextWeek),
  ]);

  const exams = overview ? toUpcomingExamAnswers(overview.session, now).exams : [];
  const requestAnswers = selectRequestAnswers(requests, AI_MAX_REQUESTS).items;
  const noticeAnswers = selectNotificationAnswers(notifications.items, AI_MAX_NOTIFICATIONS).items;
  const deadlineResult = toUpcomingDeadlineAnswers(exams, requestAnswers, noticeAnswers, now, days);
  const scheduleDays = [currentWeek, followingWeek].flatMap((week) =>
    week ? week.days.map(toScheduleDayAnswer) : [],
  );
  const changeResult = toUpcomingChangeAnswers(scheduleDays, now, days);

  return {
    available: true,
    horizonDays: days,
    deadlines: deadlineResult.items,
    changes: changeResult.items,
    truncated: deadlineResult.truncated || changeResult.truncated,
  };
}

/**
 * Собирает пять read-only инструментов для одного студента.
 *
 * `userId` замыкается здесь и не попадает ни в схемы входа, ни в описания;
 * `now` фиксирует «сегодня» для расписания и экзаменов, поэтому ответ
 * детерминирован в тестах. `context.requestId` нужен только серверному логу
 * сбоя инструмента.
 */
export function createAiTools(
  userId: string,
  now: Date = new Date(),
  context?: AiToolContext,
): ToolSet {
  return {
    getSchedule: tool({
      description: "Занятия студента на сегодня или на учебную неделю. Только чтение.",
      inputSchema: scheduleToolInputSchema,
      execute: async ({ range, weekOf }) =>
        runTool<ScheduleAnswer>(
          context,
          { available: false, range, days: [], truncated: false },
          () => buildScheduleAnswer(userId, range, weekOf, now),
        ),
    }),
    getGrades: tool({
      description: "Оценки, сводка и ближайшие экзамены за семестр. Только чтение.",
      inputSchema: gradesToolInputSchema,
      execute: async ({ semesterId }) =>
        runTool<GradesAnswer>(
          context,
          {
            available: false,
            semester: null,
            summary: null,
            grades: [],
            upcomingExams: [],
            truncated: false,
          },
          () => buildGradesAnswer(userId, semesterId, now),
        ),
    }),
    getRequests: tool({
      description: "Последние заявки студента или одна заявка по идентификатору. Только чтение.",
      inputSchema: requestsToolInputSchema,
      execute: async ({ requestId }) =>
        runTool<RequestsAnswer>(
          context,
          { available: false, items: [], detail: null, truncated: false },
          () => buildRequestsAnswer(userId, requestId),
        ),
    }),
    getNotifications: tool({
      description: "Уведомления студента с отметкой о прочтении. Только чтение.",
      inputSchema: notificationsToolInputSchema,
      execute: async ({ category, limit }) =>
        runTool<NotificationsAnswer>(
          context,
          { available: false, items: [], unreadCount: 0, truncated: false },
          () => buildNotificationsAnswer(userId, category, limit, now),
        ),
    }),
    getUpcoming: tool({
      description:
        "Ближайшие дедлайны, экзамены, сроки заявок и изменения расписания. Только чтение.",
      inputSchema: upcomingToolInputSchema,
      execute: async ({ days }) =>
        runTool<UpcomingAnswer>(
          context,
          { available: false, horizonDays: days, deadlines: [], changes: [], truncated: false },
          () => buildUpcomingAnswer(userId, days, now),
        ),
    }),
  };
}
