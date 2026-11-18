import "server-only";

import { getFirstName } from "@/lib/format";
import { getSemesterOverview, type GradesSummary, type SessionExam } from "./grades";
import {
  getUnreadNotificationsForUser,
  UNREAD_PREVIEW_DEFAULT_LIMIT,
  type NotificationItem,
} from "./notifications";
import { getStudentProfile, type StudentProfile } from "./profile";
import { getActiveRequestsForUser, type RequestSummary } from "./requests";
import { getTodaySchedule, type LessonCard, type ScheduleDay } from "./schedule";

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
