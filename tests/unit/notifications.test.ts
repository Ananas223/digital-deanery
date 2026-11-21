import { describe, expect, it } from "vitest";

import {
  buildNotificationAudienceWhere,
  isNotificationActive,
  isNotificationVisibleToStudent,
  type StudentNotificationAudience,
} from "@/lib/domain/notification-audience";
import {
  NOTIFICATION_PAGE_SIZE,
  notificationCursorSchema,
  notificationFilterSchema,
  notificationIdSchema,
} from "@/lib/validation/notifications";

const STUDENT: StudentNotificationAudience = {
  studentId: "student-anna",
  groupId: "group-mo-21-4",
  facultyId: "faculty-fmo",
};

const NOW = new Date("2026-11-17T09:00:00.000Z");

function audience(overrides: {
  audienceType: "STUDENT" | "GROUP" | "FACULTY";
  audienceStudentId?: string | null;
  audienceGroupId?: string | null;
  audienceFacultyId?: string | null;
}) {
  return {
    audienceStudentId: null,
    audienceGroupId: null,
    audienceFacultyId: null,
    ...overrides,
  };
}

describe("notificationFilterSchema", () => {
  it("по умолчанию показывает все категории", () => {
    expect(notificationFilterSchema.parse({})).toEqual({ category: "ALL" });
  });

  it.each(["ALL", "DEANERY", "SCHEDULE", "REQUESTS", "DEADLINES"])(
    "принимает фильтр %s",
    (category) => {
      expect(notificationFilterSchema.parse({ category }).category).toBe(category);
    },
  );

  it("отклоняет неизвестную категорию", () => {
    expect(notificationFilterSchema.safeParse({ category: "SYSTEM" }).success).toBe(false);
  });
});

describe("курсор и идентификатор уведомления", () => {
  it("принимает cuid", () => {
    expect(notificationCursorSchema.safeParse("cm5z8x2q10000abcd1234efgh").success).toBe(true);
    expect(notificationIdSchema.safeParse("cm5z8x2q10000abcd1234efgh").success).toBe(true);
  });

  it("отклоняет произвольную строку", () => {
    expect(notificationCursorSchema.safeParse("next").success).toBe(false);
    expect(notificationIdSchema.safeParse("not-a-cuid").success).toBe(false);
  });

  it("держит размер страницы равным 20", () => {
    expect(NOTIFICATION_PAGE_SIZE).toBe(20);
  });
});

describe("isNotificationVisibleToStudent", () => {
  it("показывает персональное уведомление владельцу", () => {
    expect(
      isNotificationVisibleToStudent(
        audience({ audienceType: "STUDENT", audienceStudentId: STUDENT.studentId }),
        STUDENT,
      ),
    ).toBe(true);
  });

  it("не показывает персональное уведомление другого студента той же группы", () => {
    expect(
      isNotificationVisibleToStudent(
        audience({ audienceType: "STUDENT", audienceStudentId: "student-mark" }),
        STUDENT,
      ),
    ).toBe(false);
  });

  it("показывает уведомление группы и факультета", () => {
    expect(
      isNotificationVisibleToStudent(
        audience({ audienceType: "GROUP", audienceGroupId: STUDENT.groupId }),
        STUDENT,
      ),
    ).toBe(true);
    expect(
      isNotificationVisibleToStudent(
        audience({ audienceType: "FACULTY", audienceFacultyId: STUDENT.facultyId }),
        STUDENT,
      ),
    ).toBe(true);
  });

  it("не показывает чужую группу и чужой факультет", () => {
    expect(
      isNotificationVisibleToStudent(
        audience({ audienceType: "GROUP", audienceGroupId: "group-meo-11-2" }),
        STUDENT,
      ),
    ).toBe(false);
    expect(
      isNotificationVisibleToStudent(
        audience({ audienceType: "FACULTY", audienceFacultyId: "faculty-fmeo" }),
        STUDENT,
      ),
    ).toBe(false);
  });

  it("не показывает уведомление с незаполненной аудиторией", () => {
    expect(isNotificationVisibleToStudent(audience({ audienceType: "GROUP" }), STUDENT)).toBe(
      false,
    );
    expect(isNotificationVisibleToStudent(audience({ audienceType: "STUDENT" }), STUDENT)).toBe(
      false,
    );
  });
});

describe("isNotificationActive", () => {
  it("считает уведомление без срока активным", () => {
    expect(isNotificationActive(null, NOW)).toBe(true);
  });

  it("считает будущий срок активным", () => {
    expect(isNotificationActive(new Date(NOW.getTime() + 1), NOW)).toBe(true);
  });

  it("считает наступивший срок истёкшим", () => {
    expect(isNotificationActive(new Date(NOW.getTime() - 1), NOW)).toBe(false);
    expect(isNotificationActive(NOW, NOW)).toBe(false);
  });
});

describe("buildNotificationAudienceWhere", () => {
  it("объединяет персональную, групповую и факультетскую аудитории", () => {
    expect(buildNotificationAudienceWhere(STUDENT, NOW)).toEqual({
      AND: [
        {
          OR: [
            { audienceType: "STUDENT", audienceStudentId: STUDENT.studentId },
            { audienceType: "GROUP", audienceGroupId: STUDENT.groupId },
            { audienceType: "FACULTY", audienceFacultyId: STUDENT.facultyId },
          ],
        },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] },
      ],
    });
  });

  it("не включает истёкшие уведомления", () => {
    const where = buildNotificationAudienceWhere(STUDENT, NOW);
    const expiry = Array.isArray(where.AND) ? where.AND[1] : undefined;

    expect(expiry).toEqual({ OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] });
  });
});
