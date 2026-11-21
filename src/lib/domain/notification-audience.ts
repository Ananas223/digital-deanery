import type { Prisma } from "@/generated/prisma/client";
import type { NotificationAudience } from "@/generated/prisma/enums";

/**
 * Правила доступности уведомления студенту.
 *
 * Модуль намеренно без `server-only`: это чистые функции и типы, их
 * проверяют юнит-тесты. Аудитория берётся из профиля студента, а не из
 * аргументов клиента.
 */

export type StudentNotificationAudience = {
  studentId: string;
  groupId: string;
  facultyId: string;
};

export type NotificationAudienceFields = {
  audienceType: NotificationAudience;
  audienceStudentId: string | null;
  audienceGroupId: string | null;
  audienceFacultyId: string | null;
};

/** Персональное уведомление чужого студента не видно, даже если группа общая. */
export function isNotificationVisibleToStudent(
  notification: NotificationAudienceFields,
  student: StudentNotificationAudience,
): boolean {
  switch (notification.audienceType) {
    case "STUDENT":
      return notification.audienceStudentId === student.studentId;
    case "GROUP":
      return notification.audienceGroupId === student.groupId;
    case "FACULTY":
      return notification.audienceFacultyId === student.facultyId;
    default:
      return false;
  }
}

/** Истёкшее уведомление уходит в архив: в ленте и счётчике его нет. */
export function isNotificationActive(expiresAt: Date | null, now: Date): boolean {
  return expiresAt === null || expiresAt.getTime() > now.getTime();
}

/**
 * Условие Prisma для ленты и счётчика: аудитория студента плюс неистёкшие.
 *
 * Один построитель используют все выборки, поэтому правило нельзя случайно
 * применить в ленте и забыть в счётчике.
 */
export function buildNotificationAudienceWhere(
  student: StudentNotificationAudience,
  now: Date,
): Prisma.NotificationWhereInput {
  return {
    AND: [
      {
        OR: [
          { audienceType: "STUDENT", audienceStudentId: student.studentId },
          { audienceType: "GROUP", audienceGroupId: student.groupId },
          { audienceType: "FACULTY", audienceFacultyId: student.facultyId },
        ],
      },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  };
}
