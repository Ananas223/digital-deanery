import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/schedule/export/route";
import { createPrismaClient } from "@/lib/db/client";
import { addMoscowDays, getMoscowDateKey, startOfMoscowWeek } from "@/lib/domain/schedule-time";
import { AppError } from "@/lib/errors";

const sessionMock = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: sessionMock.requireUser }));

const prisma = createPrismaClient();

const HOUR_MS = 60 * 60 * 1000;
const MOSCOW_OFFSET_MS = 3 * HOUR_MS;

let annaId: string;
let template: {
  groupId: string;
  disciplineId: string;
  teacherId: string;
  roomId: string;
};
let seededWeekStart: Date;
let seededWeekKey: string;

function exportRequest(week?: string): Request {
  const url = new URL("http://localhost/api/schedule/export");

  if (week !== undefined) {
    url.searchParams.set("week", week);
  }

  return new Request(url);
}

/** Московское локальное время в формате ICS без `Z`. */
function moscowStamp(date: Date): string {
  return new Date(date.getTime() + MOSCOW_OFFSET_MS)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
}

beforeAll(async () => {
  const user = await prisma.user.findUnique({
    where: { email: "anna.petrova@example.com" },
    select: { id: true },
  });

  if (!user) {
    throw new Error("Демо-пользователь anna.petrova@example.com не найден; проверьте seed.");
  }

  annaId = user.id;

  sessionMock.requireUser.mockResolvedValue({
    id: annaId,
    email: "anna.petrova@example.com",
    name: "Анна Петрова",
    role: "STUDENT",
  });

  const lesson = await prisma.lesson.findFirst({
    where: { group: { code: "MO-21-4" } },
    orderBy: { startsAt: "asc" },
    select: {
      startsAt: true,
      groupId: true,
      disciplineId: true,
      teacherId: true,
      roomId: true,
    },
  });

  if (!lesson) {
    throw new Error("Нет занятия группы MO-21-4; проверьте seed.");
  }

  seededWeekStart = startOfMoscowWeek(lesson.startsAt);
  seededWeekKey = getMoscowDateKey(seededWeekStart);
  template = {
    groupId: lesson.groupId,
    disciplineId: lesson.disciplineId,
    teacherId: lesson.teacherId,
    roomId: lesson.roomId,
  };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/schedule/export", () => {
  it("отдаёт календарь выбранной недели с заголовками и отменой", async () => {
    const cancelled = await prisma.lesson.findFirst({
      where: {
        group: { code: "MO-21-4" },
        discipline: { code: "MO-101" },
        changes: { some: { type: "CANCELLATION" } },
      },
      select: { id: true },
    });

    const response = await GET(exportRequest(seededWeekKey));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="schedule-${seededWeekKey}.ics"`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = await response.text();

    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain("BEGIN:VTIMEZONE\r\n");
    expect(body).toContain("BEGIN:VEVENT\r\n");
    expect(body).toContain(`X-WR-CALNAME:Расписание MO-21-4\\, неделя ${seededWeekKey}`);
    expect(cancelled).not.toBeNull();
    expect(body).toContain(`UID:${cancelled!.id}@digital-deanery.local`);
    expect(body).toContain("STATUS:CANCELLED");
    expect(body).toContain("SUMMARY:ОТМЕНЕНО:");
  });

  it("учитывает перенос времени и количество изменений", async () => {
    const weekStart = startOfMoscowWeek(new Date("2033-04-05T12:00:00.000Z"));
    const originalStart = new Date(addMoscowDays(weekStart, 1).getTime() + 9 * HOUR_MS);
    const movedStart = new Date(addMoscowDays(weekStart, 3).getTime() + 14 * HOUR_MS);

    const lesson = await prisma.lesson.create({
      data: {
        ...template,
        type: "SEMINAR",
        subgroup: "ALL",
        startsAt: originalStart,
        endsAt: new Date(originalStart.getTime() + 90 * 60 * 1000),
      },
      select: { id: true },
    });

    try {
      await prisma.lessonChange.create({
        data: {
          lessonId: lesson.id,
          type: "TIME_CHANGE",
          reason: "Перенос для проверки выгрузки",
          newStartsAt: movedStart,
          newEndsAt: new Date(movedStart.getTime() + 90 * 60 * 1000),
        },
      });

      const response = await GET(exportRequest(getMoscowDateKey(weekStart)));

      expect(response.status).toBe(200);

      const body = await response.text();

      expect(body).toContain(`UID:${lesson.id}@digital-deanery.local`);
      expect(body).toContain(`DTSTART;TZID=Europe/Moscow:${moscowStamp(movedStart)}`);
      expect(body).toContain("SEQUENCE:1");
      expect(body).toContain("STATUS:CONFIRMED");
      expect(body).toContain("DESCRIPTION:");
    } finally {
      await prisma.lesson.deleteMany({ where: { id: lesson.id } });
    }
  });

  it("без параметра week отдаёт текущую неделю", async () => {
    const before = getMoscowDateKey(startOfMoscowWeek(new Date()));
    const response = await GET(exportRequest());
    const after = getMoscowDateKey(startOfMoscowWeek(new Date()));

    expect(response.status).toBe(200);

    const disposition = response.headers.get("content-disposition");

    expect(
      [before, after].some((key) => disposition === `attachment; filename="schedule-${key}.ics"`),
    ).toBe(true);
  });

  it("отвечает 422 на некорректную дату", async () => {
    const response = await GET(exportRequest("2026-02-30"));

    expect(response.status).toBe(422);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = (await response.json()) as { error: { code: string } };

    expect(body.error.code).toBe("VALIDATION");
  });

  it("отвечает 401 без сессии", async () => {
    sessionMock.requireUser.mockRejectedValueOnce(new AppError("UNAUTHORIZED"));

    const response = await GET(exportRequest(seededWeekKey));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = (await response.json()) as { error: { code: string } };

    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("отвечает 404, если у пользователя нет учебного профиля", async () => {
    sessionMock.requireUser.mockResolvedValueOnce({
      id: "missing-user-id",
      email: "missing@example.com",
      name: "Нет профиля",
      role: "STUDENT",
    });

    const response = await GET(exportRequest(seededWeekKey));

    expect(response.status).toBe(404);

    const body = (await response.json()) as { error: { code: string } };

    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("на пустой неделе отдаёт валидный календарь без VEVENT", async () => {
    const emptyWeekStart = startOfMoscowWeek(new Date("2035-01-08T12:00:00.000Z"));

    const response = await GET(exportRequest(getMoscowDateKey(emptyWeekStart)));

    expect(response.status).toBe(200);

    const body = await response.text();

    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body).not.toContain("BEGIN:VEVENT");
  });
});
