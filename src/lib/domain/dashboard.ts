import "server-only";

import { getFirstName } from "@/lib/format";
import { getSemesterOverview, type GradesSummary, type SessionExam } from "./grades";
import {
  getNotificationsForUser,
  getUnreadNotificationsForUser,
  UNREAD_PREVIEW_DEFAULT_LIMIT,
  type NotificationItem,
} from "./notifications";
import { getStudentProfile, type StudentProfile } from "./profile";
import {
  getActiveRequestsForUser,
  getRequestsForMorningBrief,
  type RequestSummary,
} from "./requests";
import {
  getLessonChangeLabel,
  getLessonTypeLabel,
  getTodaySchedule,
  type LessonCard,
  type ScheduleDay,
} from "./schedule";

export type DashboardBlockKey =
  | "student"
  | "nearestLesson"
  | "gradesSummary"
  | "nearestExam"
  | "activeRequests"
  | "unreadNotifications";

export type DashboardStudent = { firstName: string; groupCode: string };

export type DashboardNotifications = { count: number; items: NotificationItem[] };

export type DashboardData = {
  student: DashboardStudent | null;
  nearestLesson: LessonCard | null;
  gradesSummary: GradesSummary | null;
  nearestExam: SessionExam | null;
  /** Активные заявки: `NEW` и `IN_PROGRESS`, не более трёх новых сверху. */
  activeRequests: RequestSummary[];
  unreadNotifications: DashboardNotifications;
  /** Блоки, которые не удалось загрузить; пусто при полном успехе. */
  unavailable: DashboardBlockKey[];
};

export type MorningBriefBlockKey = "now" | "changes" | "action";

export type MorningBriefLesson = {
  lessonId: string;
  kind: "current" | "next";
  disciplineName: string;
  typeLabel: string;
  startsAt: Date;
  endsAt: Date;
  roomNumber: string;
  buildingName: string;
  changeLabel: string | null;
};

export type MorningBriefChange = {
  id: string;
  category: "DEANERY" | "SCHEDULE" | "REQUESTS" | "DEADLINES";
  title: string;
  body: string;
  href: string;
  publishedAt: Date;
};

export type MorningBriefAction = {
  kind: "REQUEST_OVERDUE" | "REQUEST_READY" | "REQUEST_DUE" | "DEBT" | "EXAM";
  title: string;
  description: string;
  href: string;
  at: Date | null;
};

export type MorningBriefData = {
  /** Текущая или ближайшая следующая пара; `null`, если занятий больше нет. */
  now: MorningBriefLesson | null;
  /** Не более двух свежих изменений из доступных студенту уведомлений. */
  changes: MorningBriefChange[];
  /** Одно действие по фиксированному приоритету. */
  action: MorningBriefAction | null;
  /** Блоки, которые не удалось загрузить; пусто при полном успехе. */
  unavailable: MorningBriefBlockKey[];
};

/** Сколько активных заявок показывает главный экран (спецификация: 3 заявки/уведомления). */
const ACTIVE_REQUESTS_LIMIT = 3;

/** Приветствие: первое слово полного имени и код группы; профиль может отсутствовать. */
function toDashboardStudent(profile: StudentProfile | null): DashboardStudent | null {
  if (!profile) {
    return null;
  }

  return {
    firstName: getFirstName(profile.fullName) || profile.fullName,
    groupCode: profile.group,
  };
}

/**
 * Текущая пара, иначе ближайшая следующая по фактическому времени.
 *
 * Отменённые занятия не участвуют: перенос и отмена уже наложены в `effective`,
 * а список дня отсортирован по возрастанию начала.
 */
function pickNearestLesson(day: ScheduleDay | null, now: Date): LessonCard | null {
  if (!day) {
    return null;
  }

  const time = now.getTime();
  const scheduled = day.lessons.filter((lesson) => lesson.effective.status === "SCHEDULED");

  const current = scheduled.find(
    (lesson) =>
      lesson.effective.startsAt.getTime() <= time && time < lesson.effective.endsAt.getTime(),
  );

  if (current) {
    return current;
  }

  return scheduled.find((lesson) => lesson.effective.startsAt.getTime() > time) ?? null;
}

/** Текущий или следующий экзамен: идущий сейчас важнее будущего; сессия отсортирована по началу. */
function pickNearestExam(session: readonly SessionExam[], now: Date): SessionExam | null {
  const time = now.getTime();

  return session.find((exam) => exam.endsAt.getTime() > time) ?? null;
}

const MORNING_CHANGES_LIMIT = 2;
const MORNING_CHANGES_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MORNING_ACTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const MORNING_EXAM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function buildMorningLesson(day: ScheduleDay | null, now: Date): MorningBriefLesson | null {
  const lesson = pickNearestLesson(day, now);

  if (!lesson) {
    return null;
  }

  const time = now.getTime();
  const lastChange = lesson.changes.at(-1);

  return {
    lessonId: lesson.id,
    kind:
      lesson.effective.startsAt.getTime() <= time && time < lesson.effective.endsAt.getTime()
        ? "current"
        : "next",
    disciplineName: lesson.effective.discipline.name,
    typeLabel: getLessonTypeLabel(lesson.type),
    startsAt: lesson.effective.startsAt,
    endsAt: lesson.effective.endsAt,
    roomNumber: lesson.effective.room.number,
    buildingName: lesson.effective.room.building.name,
    changeLabel: lastChange ? getLessonChangeLabel(lastChange.type) : null,
  };
}

function notificationHref(item: NotificationItem): string {
  if (item.targetType === "REQUEST" && item.targetId) {
    return `/requests/${item.targetId}`;
  }

  if (item.targetType === "LESSON" && item.targetId) {
    return `/schedule/${item.targetId}`;
  }

  return item.category === "REQUESTS" ? "/requests" : "/schedule";
}

function buildMorningChanges(items: readonly NotificationItem[], now: Date): MorningBriefChange[] {
  const since = now.getTime() - MORNING_CHANGES_WINDOW_MS;

  return items
    .filter(
      (item) =>
        (item.category === "SCHEDULE" || item.category === "REQUESTS") &&
        item.publishedAt.getTime() >= since,
    )
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, MORNING_CHANGES_LIMIT)
    .map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      body: item.body,
      href: notificationHref(item),
      publishedAt: item.publishedAt,
    }));
}

/**
 * Одно действие по фиксированному приоритету:
 * просрочка → готовая заявка → срок через 3 дня → задолженность → экзамен.
 * Возвращается только первое совпадение, поэтому бриф не превращается в список.
 */
function pickMorningAction(
  requests: readonly RequestSummary[],
  overview: Awaited<ReturnType<typeof getSemesterOverview>>,
  now: Date,
): MorningBriefAction | null {
  const time = now.getTime();
  const open = requests.filter(
    (request) => request.status === "NEW" || request.status === "IN_PROGRESS",
  );

  const overdue = open
    .filter((request) => request.dueAt !== null && request.dueAt.getTime() < time)
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))[0];

  if (overdue) {
    return {
      kind: "REQUEST_OVERDUE",
      title: "Заявка просрочена",
      description: `№ ${overdue.number} · ${overdue.typeTitle}. Проверьте статус и напишите в деканат.`,
      href: `/requests/${overdue.id}`,
      at: overdue.dueAt,
    };
  }

  const ready = requests.find((request) => request.status === "READY");

  if (ready) {
    return {
      kind: "REQUEST_READY",
      title: "Заявка готова",
      description: `№ ${ready.number} · ${ready.typeTitle}. Заберите документ в деканате.`,
      href: `/requests/${ready.id}`,
      at: null,
    };
  }

  const dueSoon = open
    .filter(
      (request) =>
        request.dueAt !== null &&
        request.dueAt.getTime() >= time &&
        request.dueAt.getTime() <= time + MORNING_ACTION_WINDOW_MS,
    )
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))[0];

  if (dueSoon) {
    return {
      kind: "REQUEST_DUE",
      title: "Срок заявки близко",
      description: `№ ${dueSoon.number} · ${dueSoon.typeTitle}. Плановая готовность уже скоро.`,
      href: `/requests/${dueSoon.id}`,
      at: dueSoon.dueAt,
    };
  }

  if (overview && overview.summary.debtCount > 0) {
    return {
      kind: "DEBT",
      title: "Есть задолженности",
      description: `Закрыть: ${overview.summary.debtCount}. Посмотрите, что нужно сдать.`,
      href: "/grades",
      at: null,
    };
  }

  const exam = overview ? pickNearestExam(overview.session, now) : null;

  if (exam && exam.startsAt.getTime() <= time + MORNING_EXAM_WINDOW_MS) {
    return {
      kind: "EXAM",
      title: "Ближайший экзамен",
      description: `${exam.discipline.name}. Проверьте время и аудиторию.`,
      href: "/grades?tab=session",
      at: exam.startsAt,
    };
  }

  return null;
}

/**
 * Утренний бриф: три детерминированные карточки без LLM.
 *
 * Источники читаются независимо: отказ одного блока не роняет остальные, а
 * попадает в `unavailable`. Данные принадлежат только текущему студенту
 * (`userId` из проверенной сессии). Новых оценок здесь нет: существующий
 * контракт уведомлений не создаёт событие для оценки, поэтому бриф не
 * придумывает его. Кеша нет.
 */
export async function getMorningBrief(
  userId: string,
  now: Date = new Date(),
): Promise<MorningBriefData> {
  const [scheduleResult, requestsResult, gradesResult, notificationsResult] =
    await Promise.allSettled([
      getTodaySchedule(userId, now),
      getRequestsForMorningBrief(userId),
      getSemesterOverview(userId, undefined, now),
      getNotificationsForUser(userId, { category: "ALL", scope: "ACTIVE" }, undefined, now),
    ]);

  const nowCard =
    scheduleResult.status === "fulfilled" ? buildMorningLesson(scheduleResult.value, now) : null;
  const changes =
    notificationsResult.status === "fulfilled"
      ? buildMorningChanges(notificationsResult.value.items, now)
      : [];
  const overview = gradesResult.status === "fulfilled" ? gradesResult.value : null;
  const action =
    requestsResult.status === "fulfilled"
      ? pickMorningAction(requestsResult.value, overview, now)
      : null;

  const unavailable: MorningBriefBlockKey[] = [];

  if (scheduleResult.status === "rejected") {
    unavailable.push("now");
  }

  if (notificationsResult.status === "rejected") {
    unavailable.push("changes");
  }

  if (requestsResult.status === "rejected" || gradesResult.status === "rejected") {
    unavailable.push("action");
  }

  return {
    now: nowCard,
    changes,
    action,
    unavailable,
  };
}

/**
 * Собирает данные главного экрана из готовых доменных читателей.
 *
 * `userId` приходит только из проверенной серверной сессии; клиентский
 * идентификатор сюда не передаётся. Пять источников загружаются параллельно и
 * независимо: отказ одного блока не роняет остальные, а попадает в
 * `unavailable` в фиксированном порядке. Отсутствие профиля или данных — это
 * корректный пустой результат, а не сбой.
 *
 * Заявки и непрочитанные уведомления ограничены тремя элементами: полные
 * списки доступны в своих разделах. Кеша нет: данные персонализированы и
 * читаются заново на каждый запрос.
 */
export async function getDashboardData(
  userId: string,
  now: Date = new Date(),
): Promise<DashboardData> {
  const [studentResult, scheduleResult, gradesResult, requestsResult, notificationsResult] =
    await Promise.allSettled([
      getStudentProfile(userId),
      getTodaySchedule(userId, now),
      getSemesterOverview(userId, undefined, now),
      getActiveRequestsForUser(userId),
      getUnreadNotificationsForUser(userId, UNREAD_PREVIEW_DEFAULT_LIMIT, now),
    ]);

  const student =
    studentResult.status === "fulfilled" ? toDashboardStudent(studentResult.value) : null;
  const nearestLesson =
    scheduleResult.status === "fulfilled" ? pickNearestLesson(scheduleResult.value, now) : null;

  const overview = gradesResult.status === "fulfilled" ? gradesResult.value : null;

  const activeRequests =
    requestsResult.status === "fulfilled"
      ? requestsResult.value.slice(0, ACTIVE_REQUESTS_LIMIT)
      : [];
  const unreadNotifications =
    notificationsResult.status === "fulfilled"
      ? notificationsResult.value
      : { count: 0, items: [] };

  const unavailable: DashboardBlockKey[] = [];

  if (studentResult.status === "rejected") {
    unavailable.push("student");
  }

  if (scheduleResult.status === "rejected") {
    unavailable.push("nearestLesson");
  }

  if (gradesResult.status === "rejected") {
    unavailable.push("gradesSummary", "nearestExam");
  }

  if (requestsResult.status === "rejected") {
    unavailable.push("activeRequests");
  }

  if (notificationsResult.status === "rejected") {
    unavailable.push("unreadNotifications");
  }

  return {
    student,
    nearestLesson,
    gradesSummary: overview?.summary ?? null,
    nearestExam: overview ? pickNearestExam(overview.session, now) : null,
    activeRequests,
    unreadNotifications,
    unavailable,
  };
}
