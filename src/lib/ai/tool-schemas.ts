import { z } from "zod";

import type {
  NotificationCategory,
  NotificationPriority,
  NotificationTarget,
  RequestStatus,
} from "@/generated/prisma/enums";
import {
  getAssessmentTypeLabel,
  getGradeStatusLabel,
  getSemesterLabel,
  type GradeEntry,
  type GradesSummary,
  type Semester,
  type SessionExam,
} from "@/lib/domain/grades";
import type { NotificationItem } from "@/lib/domain/notifications";
import type { RequestDetail, RequestHistoryEntry, RequestSummary } from "@/lib/domain/requests";
import { REQUEST_STATUS_LABELS } from "@/lib/domain/request-status";
import {
  getLessonChangeLabel,
  getLessonSubgroupLabel,
  getLessonTypeLabel,
  type LessonChangeInput,
  type ScheduleDay,
  type ScheduleLesson,
} from "@/lib/domain/schedule";
import { NOTIFICATION_CATEGORIES } from "@/lib/validation/notifications";
import type { RequestPayloadInput } from "@/lib/validation/requests";

/**
 * Входные схемы, выходные типы и чистые преобразования инструментов помощника
 * (`docs/specs/p9-ai-assistant.md` § 4.4, `docs/adr/0005-ai-assistant.md`).
 *
 * Модуль не обращается к базе: он только описывает аргументы модели, усекает
 * результаты и превращает доменные записи в короткий JSON-совместимый ответ.
 * Сырые `Date` наружу не выходят — только ISO-строки. Ни одна схема не содержит
 * `userId`: идентификатор студента подставляет сервер из проверенной сессии.
 */

/** Максимум занятий в одном дне ответа. */
export const AI_MAX_LESSONS_PER_DAY = 10;

/** Максимум занятий за неделю: защита контекста модели от длинной недели. */
export const AI_MAX_LESSONS_PER_WEEK = 40;

/** Максимум дисциплин успеваемости: задолженности идут первыми. */
export const AI_MAX_GRADES = 10;

/** Максимум ближайших экзаменов и зачётов. */
export const AI_MAX_EXAMS = 5;

/** Максимум заявок в списке. */
export const AI_MAX_REQUESTS = 5;

/** Максимум уведомлений и верхняя граница аргумента `limit`. */
export const AI_MAX_NOTIFICATIONS = 5;

/** Горизонт «ближайших» событий: от одного дня до месяца. */
export const AI_MAX_UPCOMING_DAYS = 30;

/** Максимум дедлайнов в ответе `getUpcoming`. */
export const AI_MAX_UPCOMING_ITEMS = 10;

/** Максимум изменений расписания в ответе `getUpcoming`. */
export const AI_MAX_UPCOMING_CHANGES = 10;

/** Сколько последних записей истории заявки показывать модели. */
export const AI_MAX_REQUEST_HISTORY = 10;

export const scheduleRangeSchema = z.enum(["today", "week"]);

export type ScheduleRange = z.infer<typeof scheduleRangeSchema>;

/** Вход `getSchedule`: на какой день или неделю смотреть расписание. */
export const scheduleToolInputSchema = z.object({
  range: scheduleRangeSchema
    .default("today")
    .describe("Диапазон: «today» — занятия на текущий день, «week» — на всю учебную неделю."),
  weekOf: z.iso
    .date("Укажите дату в формате ГГГГ-ММ-ДД")
    .optional()
    .describe("Дата внутри нужной недели в формате ГГГГ-ММ-ДД; без неё берётся текущая неделя."),
});

/** Вход `getGrades`: семестр успеваемости. */
export const gradesToolInputSchema = z.object({
  semesterId: z
    .cuid("Некорректный идентификатор семестра")
    .optional()
    .describe("Семестр; без значения берётся текущий семестр."),
});

/** Вход `getRequests`: список заявок или одна заявка. */
export const requestsToolInputSchema = z.object({
  requestId: z
    .cuid("Некорректный идентификатор заявки")
    .optional()
    .describe("Идентификатор заявки для подробностей; без него — последние заявки."),
});

/** Вход `getNotifications`: категория и число уведомлений. */
export const notificationsToolInputSchema = z.object({
  category: z
    .enum(NOTIFICATION_CATEGORIES)
    .optional()
    .describe("Категория уведомлений; без значения — все категории."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(AI_MAX_NOTIFICATIONS)
    .optional()
    .describe(`Сколько уведомлений вернуть: от 1 до ${AI_MAX_NOTIFICATIONS}.`),
});

/** Вход `getUpcoming`: на сколько дней вперёд смотреть дедлайны и изменения. */
export const upcomingToolInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(AI_MAX_UPCOMING_DAYS)
    .default(14)
    .describe(`Горизонт в днях: от 1 до ${AI_MAX_UPCOMING_DAYS}.`),
});

export type ScheduleToolInput = z.infer<typeof scheduleToolInputSchema>;
export type GradesToolInput = z.infer<typeof gradesToolInputSchema>;
export type RequestsToolInput = z.infer<typeof requestsToolInputSchema>;
export type NotificationsToolInput = z.infer<typeof notificationsToolInputSchema>;
export type UpcomingToolInput = z.infer<typeof upcomingToolInputSchema>;

export type ScheduleLessonAnswer = {
  id: string;
  discipline: string;
  type: string;
  subgroup: string;
  startsAt: string;
  endsAt: string;
  teacher: string;
  room: string;
  building: string;
  status: "SCHEDULED" | "CANCELLED";
  changes: string[];
};

export type ScheduleDayAnswer = {
  date: string;
  lessons: ScheduleLessonAnswer[];
};

export type ScheduleAnswer = {
  available: boolean;
  range: ScheduleRange;
  date?: string;
  weekStart?: string;
  weekNumber?: number;
  days: ScheduleDayAnswer[];
  truncated: boolean;
};

export type GradeAnswer = {
  discipline: string;
  assessmentType: string;
  credits: number;
  score: number | null;
  status: string;
};

export type ExamAnswer = {
  discipline: string;
  assessmentType: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
  teacher: string;
  result: { score: number | null; status: string } | null;
};

export type GradesAnswer = {
  available: boolean;
  semester: { id: string; label: string; isCurrent: boolean } | null;
  summary: GradesSummary | null;
  grades: GradeAnswer[];
  upcomingExams: ExamAnswer[];
  truncated: boolean;
};

export type RequestAnswer = {
  id: string;
  number: string;
  typeTitle: string;
  status: string;
  createdAt: string;
  dueAt: string | null;
  rejectionReason: string | null;
};

export type RequestHistoryAnswer = {
  from: string | null;
  to: string;
  comment: string | null;
  changedByName: string | null;
  createdAt: string;
};

export type RequestDetailAnswer = RequestAnswer & {
  payload: RequestPayloadInput["payload"] | null;
  history: RequestHistoryAnswer[];
  canCancel: boolean;
};

export type RequestsAnswer = {
  available: boolean;
  items: RequestAnswer[];
  detail: RequestDetailAnswer | null;
  truncated: boolean;
};

export type NotificationAnswer = {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  publishedAt: string;
  isRead: boolean;
  targetType: NotificationTarget;
  targetId: string | null;
};

export type NotificationsAnswer = {
  available: boolean;
  items: NotificationAnswer[];
  unreadCount: number;
  truncated: boolean;
};

/** Источник дедлайна: экзамен, срок заявки или объявление из ленты. */
export type UpcomingDeadlineSource = "EXAM" | "REQUEST" | "NOTICE";

export type UpcomingDeadlineAnswer = {
  source: UpcomingDeadlineSource;
  title: string;
  /** Срок в ISO 8601; у объявления без точной даты — `null`. */
  dueAt: string | null;
  /** Дата публикации объявления; у экзамена и заявки — `null`. */
  publishedAt: string | null;
  details: string;
};

export type UpcomingChangeAnswer = {
  discipline: string;
  startsAt: string;
  room: string;
  changes: string[];
};

export type UpcomingAnswer = {
  available: boolean;
  horizonDays: number;
  deadlines: UpcomingDeadlineAnswer[];
  changes: UpcomingChangeAnswer[];
  truncated: boolean;
};

/** Минимальная форма аудитории для подписи: подходит и занятию, и экзамену. */
type RoomLike = {
  number: string;
  name: string | null;
  building: { code: string };
};

/** Корпус и аудитория одной строкой: «Аудитория 203 (корпус A, ауд. 203)». */
export function formatRoomLabel(room: RoomLike): string {
  const location = `корпус ${room.building.code}, ауд. ${room.number}`;

  return room.name ? `${room.name} (${location})` : location;
}

/** Подпись изменения занятия: тип и, если есть, причина из домена. */
function toLessonChangeAnswer(change: LessonChangeInput): string {
  const label = getLessonChangeLabel(change.type);

  return change.reason ? `${label} — ${change.reason}` : label;
}

/** Фактическое состояние занятия без идентификаторов преподавателя и аудитории. */
export function toScheduleLessonAnswer(lesson: ScheduleLesson): ScheduleLessonAnswer {
  const { effective } = lesson;

  return {
    id: lesson.id,
    discipline: effective.discipline.name,
    type: getLessonTypeLabel(lesson.type),
    subgroup: getLessonSubgroupLabel(lesson.subgroup),
    startsAt: effective.startsAt.toISOString(),
    endsAt: effective.endsAt.toISOString(),
    teacher: effective.teacher.fullName,
    room: formatRoomLabel(effective.room),
    building: effective.room.building.name,
    status: effective.status,
    changes: lesson.changes.map(toLessonChangeAnswer),
  };
}

export function toScheduleDayAnswer(day: ScheduleDay): ScheduleDayAnswer {
  return {
    date: day.date,
    lessons: day.lessons.map(toScheduleLessonAnswer),
  };
}

/**
 * Усекает занятия: не более `maxPerDay` в дне и `maxTotal` за весь ответ.
 *
 * Отменённые занятия остаются в списке со статусом `CANCELLED`: модель должна
 * видеть, что пара не состоится, а не считать день пустым.
 */
export function truncateScheduleDays(
  days: readonly ScheduleDayAnswer[],
  maxPerDay: number = AI_MAX_LESSONS_PER_DAY,
  maxTotal: number = AI_MAX_LESSONS_PER_WEEK,
): { days: ScheduleDayAnswer[]; truncated: boolean } {
  let remaining = Math.max(0, maxTotal);
  let truncated = false;

  const limitedDays = days.map((day) => {
    const allowed = Math.min(maxPerDay, remaining);
    const lessons = day.lessons.slice(0, Math.max(0, allowed));

    if (lessons.length < day.lessons.length) {
      truncated = true;
    }

    remaining -= lessons.length;

    return { date: day.date, lessons };
  });

  return { days: limitedDays, truncated };
}

/** `weekOf` — календарная дата: полночь UTC без сдвига часового пояса. */
export function parseWeekOfDate(weekOf: string | undefined, now: Date): Date {
  return weekOf ? new Date(`${weekOf}T00:00:00.000Z`) : now;
}

export function toSemesterAnswer(semester: Semester): {
  id: string;
  label: string;
  isCurrent: boolean;
} {
  return {
    id: semester.id,
    label: getSemesterLabel(semester),
    isCurrent: semester.isCurrent,
  };
}

function toGradeAnswer(entry: GradeEntry): GradeAnswer {
  return {
    discipline: entry.discipline.name,
    assessmentType: getAssessmentTypeLabel(entry.assessmentType),
    credits: entry.credits,
    score: entry.score,
    status: getGradeStatusLabel(entry.status),
  };
}

/**
 * Ранг задолженности: 0 — незачёт, 1 — невыставленная оценка после семестра,
 * 2 — остальные дисциплины.
 *
 * Правило совпадает со сводкой (`buildGradesSummary`): `NOT_GRADED` — долг
 * только когда семестр уже закончился (`now > semester.endsAt`). Во время
 * семестра оценка просто ещё не выставлена, и помещать её в начало списка
 * задолженностей нельзя.
 */
function debtRank(entry: GradeEntry, semesterEndsAt: Date, now: Date): 0 | 1 | 2 {
  if (entry.status === "FAILED") {
    return 0;
  }

  if (entry.status === "NOT_GRADED" && now.getTime() > semesterEndsAt.getTime()) {
    return 1;
  }

  return 2;
}

/**
 * Дисциплины для ответа: сначала незачёты, затем просроченные «не выставлено»,
 * затем остальные по названию.
 *
 * Ограничение применяется после сортировки, поэтому долги не вытесняются
 * длинным хвостом закрытых дисциплин.
 */
export function toGradeAnswers(
  entries: readonly GradeEntry[],
  semesterEndsAt: Date,
  now: Date,
  limit: number = AI_MAX_GRADES,
): { grades: GradeAnswer[]; truncated: boolean } {
  const sorted = [...entries].sort((left, right) => {
    const byDebt = debtRank(left, semesterEndsAt, now) - debtRank(right, semesterEndsAt, now);

    if (byDebt !== 0) {
      return byDebt;
    }

    return left.discipline.name.localeCompare(right.discipline.name, "ru-RU");
  });

  const limited = sorted.slice(0, limit);

  return {
    grades: limited.map(toGradeAnswer),
    truncated: sorted.length > limited.length,
  };
}

export function toExamAnswer(exam: SessionExam): ExamAnswer {
  return {
    discipline: exam.discipline.name,
    assessmentType: getAssessmentTypeLabel(exam.assessmentType),
    startsAt: exam.startsAt.toISOString(),
    endsAt: exam.endsAt.toISOString(),
    room: exam.room
      ? formatRoomLabel({
          number: exam.room.number,
          name: exam.room.name,
          building: { code: exam.room.buildingCode },
        })
      : null,
    teacher: exam.teacherName ?? "не указан",
    result: exam.result
      ? { score: exam.result.score, status: getGradeStatusLabel(exam.result.status) }
      : null,
  };
}

/** Ближайшие экзамены и зачёты: только будущие, по времени начала. */
export function toUpcomingExamAnswers(
  session: readonly SessionExam[],
  now: Date,
  limit: number = AI_MAX_EXAMS,
): { exams: ExamAnswer[]; truncated: boolean } {
  const upcoming = session
    .filter((exam) => exam.startsAt.getTime() >= now.getTime())
    .sort(
      (left, right) =>
        left.startsAt.getTime() - right.startsAt.getTime() ||
        left.discipline.name.localeCompare(right.discipline.name, "ru-RU"),
    );

  const limited = upcoming.slice(0, limit);

  return {
    exams: limited.map(toExamAnswer),
    truncated: upcoming.length > limited.length,
  };
}

function toRequestStatusLabel(status: RequestStatus): string {
  return REQUEST_STATUS_LABELS[status];
}

export function toRequestAnswer(request: RequestSummary): RequestAnswer {
  return {
    id: request.id,
    number: request.number,
    typeTitle: request.typeTitle,
    status: toRequestStatusLabel(request.status),
    createdAt: request.createdAt.toISOString(),
    dueAt: request.dueAt ? request.dueAt.toISOString() : null,
    rejectionReason: request.rejectionReason,
  };
}

function toRequestHistoryAnswer(entry: RequestHistoryEntry): RequestHistoryAnswer {
  return {
    from: entry.fromStatus ? toRequestStatusLabel(entry.fromStatus) : null,
    to: toRequestStatusLabel(entry.toStatus),
    comment: entry.comment,
    changedByName: entry.changedByName,
    createdAt: entry.createdAt.toISOString(),
  };
}

/** Карточка заявки: свои поля заявки, разобранный payload и последние шаги. */
export function toRequestDetailAnswer(request: RequestDetail): RequestDetailAnswer {
  return {
    ...toRequestAnswer(request),
    payload: request.payload,
    history: request.history.slice(-AI_MAX_REQUEST_HISTORY).map(toRequestHistoryAnswer),
    canCancel: request.canCancel,
  };
}

export function selectRequestAnswers(
  requests: readonly RequestSummary[],
  limit: number = AI_MAX_REQUESTS,
): { items: RequestAnswer[]; truncated: boolean } {
  const limited = requests.slice(0, limit);

  return {
    items: limited.map(toRequestAnswer),
    truncated: requests.length > limited.length,
  };
}

export function toNotificationAnswer(item: NotificationItem): NotificationAnswer {
  return {
    id: item.id,
    category: item.category,
    priority: item.priority,
    title: item.title,
    body: item.body,
    publishedAt: item.publishedAt.toISOString(),
    isRead: item.isRead,
    targetType: item.targetType,
    targetId: item.targetId,
  };
}

export function selectNotificationAnswers(
  items: readonly NotificationItem[],
  limit: number = AI_MAX_NOTIFICATIONS,
): { items: NotificationAnswer[]; truncated: boolean } {
  const limited = items.slice(0, limit);

  return {
    items: limited.map(toNotificationAnswer),
    truncated: items.length > limited.length,
  };
}

/**
 * Сводит экзамены, сроки активных заявок и объявления о дедлайнах в один
 * список «ближайшего».
 *
 * Экзамены и заявки имеют точный срок и сортируются по нему. Объявления из
 * ленты точной даты срока не содержат: у них заполняется `publishedAt`, а
 * `dueAt` остаётся `null`, чтобы модель не выдала дату публикации за дедлайн.
 * Объявления идут после событий с точной датой.
 */
export function toUpcomingDeadlineAnswers(
  exams: readonly ExamAnswer[],
  requests: readonly RequestAnswer[],
  notices: readonly NotificationAnswer[],
  now: Date,
  horizonDays: number,
  limit: number = AI_MAX_UPCOMING_ITEMS,
): { items: UpcomingDeadlineAnswer[]; truncated: boolean } {
  const nowMs = now.getTime();
  const horizonMs = nowMs + horizonDays * 24 * 60 * 60 * 1000;
  const dated: UpcomingDeadlineAnswer[] = [];

  for (const exam of exams) {
    const startsAt = Date.parse(exam.startsAt);

    if (startsAt >= nowMs && startsAt <= horizonMs) {
      dated.push({
        source: "EXAM",
        title: exam.discipline,
        dueAt: exam.startsAt,
        publishedAt: null,
        details: exam.room ? `${exam.assessmentType}, ${exam.room}` : exam.assessmentType,
      });
    }
  }

  for (const request of requests) {
    if (!request.dueAt) {
      continue;
    }

    const dueAt = Date.parse(request.dueAt);

    if (dueAt >= nowMs && dueAt <= horizonMs) {
      dated.push({
        source: "REQUEST",
        title: `${request.typeTitle} № ${request.number}`,
        dueAt: request.dueAt,
        publishedAt: null,
        details: request.status,
      });
    }
  }

  dated.sort(
    (left, right) =>
      Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? "") ||
      left.title.localeCompare(right.title, "ru-RU"),
  );

  const noticeItems = [...notices]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, 3)
    .map<UpcomingDeadlineAnswer>((notice) => ({
      source: "NOTICE",
      title: notice.title,
      dueAt: null,
      publishedAt: notice.publishedAt,
      details: notice.body,
    }));

  const combined = [...dated, ...noticeItems];
  const limited = combined.slice(0, limit);

  return {
    items: limited,
    truncated: combined.length > limited.length,
  };
}

/**
 * Оставляет изменения расписания, которые ещё впереди и попадают в горизонт.
 *
 * Отменённое занятие тоже считается изменением: студенту важно узнать об
 * отмене до начала пары, а не после.
 */
export function toUpcomingChangeAnswers(
  days: readonly ScheduleDayAnswer[],
  now: Date,
  horizonDays: number,
  limit: number = AI_MAX_UPCOMING_CHANGES,
): { items: UpcomingChangeAnswer[]; truncated: boolean } {
  const nowMs = now.getTime();
  const horizonMs = nowMs + horizonDays * 24 * 60 * 60 * 1000;

  const changes = days
    .flatMap((day) => day.lessons)
    .filter((lesson) => lesson.changes.length > 0)
    .filter((lesson) => {
      const startsAt = Date.parse(lesson.startsAt);

      return startsAt >= nowMs && startsAt <= horizonMs;
    })
    .sort(
      (left, right) =>
        Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
        left.discipline.localeCompare(right.discipline, "ru-RU"),
    )
    .map<UpcomingChangeAnswer>((lesson) => ({
      discipline: lesson.discipline,
      startsAt: lesson.startsAt,
      room: lesson.room,
      changes: lesson.changes,
    }));

  const limited = changes.slice(0, limit);

  return {
    items: limited,
    truncated: changes.length > limited.length,
  };
}
