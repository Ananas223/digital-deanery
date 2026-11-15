import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import { getTodaySchedule, getWeekSchedule } from "@/lib/domain/schedule";
import { addMoscowDays, getMoscowDateKey, startOfMoscowWeek } from "@/lib/domain/schedule-time";

const prisma = createPrismaClient();

const HOUR_MS = 60 * 60 * 1000;
const NOON_OFFSET_MS = 12 * HOUR_MS;

afterAll(async () => {
  await prisma.$disconnect();
});

async function findStudent(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return user.id;
}

/** Понедельник той недели, на которую seed разложил демо-расписание. */
async function getGroupWeekStart(groupCode: string): Promise<Date> {
  const lesson = await prisma.lesson.findFirst({
    where: { group: { code: groupCode } },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });

  if (!lesson) {
    throw new Error(`У группы ${groupCode} нет занятий; проверьте seed.`);
  }

  return startOfMoscowWeek(lesson.startsAt);
}

/** Минимальный набор полей занятия для временных записей в тестах. */
async function getLessonTemplate() {
  const template = await prisma.lesson.findFirst({
    where: { group: { code: "MO-21-4" } },
    orderBy: { startsAt: "asc" },
    select: { groupId: true, disciplineId: true, teacherId: true, roomId: true },
  });

  if (!template) {
    throw new Error("Нет занятия-шаблона для проверки переноса; проверьте seed.");
  }

  return template;
}

function noonOf(dayStart: Date): Date {
  return new Date(dayStart.getTime() + NOON_OFFSET_MS);
}

describe("расписание на день", () => {
  it("отдаёт занятия своей группы и подгруппы с применёнными изменениями", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");

    const monday = await getTodaySchedule(annaId, noonOf(weekStart));

    expect(monday).not.toBeNull();
    expect(monday?.date).toBe(getMoscowDateKey(weekStart));
    expect(monday?.lessons.map((lesson) => lesson.effective.discipline.code)).toEqual([
      "MO-101",
      "MO-102",
      "MO-103",
    ]);
    expect(monday?.lessons.every((lesson) => lesson.groupCode === "MO-21-4")).toBe(true);
    expect(monday?.lessons.every((lesson) => lesson.subgroup !== "SECOND")).toBe(true);

    const cancelled = monday?.lessons.find(
      (lesson) => lesson.effective.discipline.code === "MO-101",
    );
    expect(cancelled?.effective.status).toBe("CANCELLED");
    expect(cancelled?.changes.length).toBeGreaterThan(0);

    const practice = monday?.lessons.find(
      (lesson) => lesson.effective.discipline.code === "MO-102",
    );
    expect(practice?.effective.status).toBe("SCHEDULED");
  });

  it("учитывает перенос времени при сортировке дня", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");
    const tuesday = addMoscowDays(weekStart, 1);

    const day = await getTodaySchedule(annaId, noonOf(tuesday));
    const codes = day?.lessons.map((lesson) => lesson.effective.discipline.code);

    expect(codes).toEqual(["MO-104", "MO-105", "MO-103"]);

    const moved = day?.lessons.find((lesson) => lesson.effective.discipline.code === "MO-105");
    expect(moved?.effective.startsAt.getTime()).toBeGreaterThan(
      moved?.original.startsAt.getTime() ?? 0,
    );
    expect(moved?.changes.some((change) => change.type === "TIME_CHANGE")).toBe(true);
  });

  it("возвращает пустой день без ошибки", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");
    const sunday = addMoscowDays(weekStart, 6);

    const day = await getTodaySchedule(annaId, noonOf(sunday));

    expect(day?.date).toBe(getMoscowDateKey(sunday));
    expect(day?.lessons).toEqual([]);
  });

  it("возвращает null, если у пользователя нет академического профиля", async () => {
    await expect(getTodaySchedule("missing-user-id", new Date())).resolves.toBeNull();
  });
});

describe("расписание на неделю", () => {
  it("содержит семь дней, номер недели и все занятия без потерь", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");

    const week = await getWeekSchedule(annaId, noonOf(weekStart));

    expect(week).not.toBeNull();
    expect(week?.weekStart).toBe(getMoscowDateKey(weekStart));
    expect(week?.weekNumber).toBeGreaterThanOrEqual(1);
    expect(week?.days).toHaveLength(7);
    expect(week?.days[0]?.date).toBe(getMoscowDateKey(weekStart));
    expect(week?.days[6]?.date).toBe(getMoscowDateKey(addMoscowDays(weekStart, 6)));
    expect(week?.days[6]?.lessons).toEqual([]);

    const lessons = week?.days.flatMap((day) => day.lessons) ?? [];
    expect(lessons).toHaveLength(14);
    expect(lessons.every((lesson) => lesson.groupCode === "MO-21-4")).toBe(true);
    expect(lessons.some((lesson) => lesson.subgroup === "SECOND")).toBe(false);

    const sorted = [...lessons].sort(
      (a, b) => a.effective.startsAt.getTime() - b.effective.startsAt.getTime(),
    );
    expect(lessons.map((lesson) => lesson.id)).toEqual(sorted.map((lesson) => lesson.id));
  });

  it("не показывает расписание чужой группы", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const markId = await findStudent("mark.sokolov@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");

    const annaWeek = await getWeekSchedule(annaId, noonOf(weekStart));
    const markWeek = await getWeekSchedule(markId, noonOf(weekStart));

    const annaIds = new Set(annaWeek?.days.flatMap((day) => day.lessons.map((l) => l.id)) ?? []);
    const markLessons = markWeek?.days.flatMap((day) => day.lessons) ?? [];

    expect(markLessons).toHaveLength(10);
    expect(markLessons.every((lesson) => lesson.groupCode === "MEO-11-2")).toBe(true);
    expect(markLessons.some((lesson) => lesson.subgroup === "FIRST")).toBe(false);
    expect(markLessons.some((lesson) => annaIds.has(lesson.id))).toBe(false);
  });

  it("возвращает пустую неделю как семь пустых дней", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");
    const emptyWeekStart = addMoscowDays(weekStart, 7);

    const week = await getWeekSchedule(annaId, noonOf(emptyWeekStart));

    expect(week?.days).toHaveLength(7);
    expect(week?.days.every((day) => day.lessons.length === 0)).toBe(true);
  });

  it("переносит занятие на другой день недели", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const template = await getLessonTemplate();

    const weekStart = startOfMoscowWeek(new Date("2031-05-06T12:00:00.000Z"));
    const tuesdayStart = new Date(addMoscowDays(weekStart, 1).getTime() + 9 * HOUR_MS);
    const thursdayStart = new Date(addMoscowDays(weekStart, 3).getTime() + 11 * HOUR_MS);

    const lesson = await prisma.lesson.create({
      data: {
        ...template,
        type: "SEMINAR",
        subgroup: "ALL",
        startsAt: tuesdayStart,
        endsAt: new Date(tuesdayStart.getTime() + 90 * 60 * 1000),
      },
      select: { id: true },
    });

    try {
      await prisma.lessonChange.create({
        data: {
          lessonId: lesson.id,
          type: "TIME_CHANGE",
          reason: "Перенос на другой день",
          newStartsAt: thursdayStart,
          newEndsAt: new Date(thursdayStart.getTime() + 90 * 60 * 1000),
        },
      });

      const week = await getWeekSchedule(annaId, noonOf(weekStart));
      const thursday = week?.days[3]?.lessons.find((item) => item.id === lesson.id);
      const tuesday = week?.days[1]?.lessons.find((item) => item.id === lesson.id);

      expect(tuesday).toBeUndefined();
      expect(thursday?.effective.startsAt.getTime()).toBe(thursdayStart.getTime());

      const tuesdayDay = await getTodaySchedule(annaId, noonOf(addMoscowDays(weekStart, 1)));
      expect(tuesdayDay?.lessons.some((item) => item.id === lesson.id)).toBe(false);
    } finally {
      await prisma.lesson.deleteMany({ where: { id: lesson.id } });
    }
  });

  it("возвращает null, если у пользователя нет академического профиля", async () => {
    await expect(getWeekSchedule("missing-user-id", new Date())).resolves.toBeNull();
  });
});

describe("границы недели и сохранность изменений", () => {
  it("включает занятие ровно в начале недели и исключает ровно в начале следующей", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const template = await getLessonTemplate();
    const weekStart = startOfMoscowWeek(new Date("2032-02-02T12:00:00.000Z"));
    const nextWeekStart = addMoscowDays(weekStart, 7);

    const atStart = await prisma.lesson.create({
      data: {
        ...template,
        type: "SEMINAR",
        subgroup: "ALL",
        startsAt: weekStart,
        endsAt: new Date(weekStart.getTime() + 90 * 60 * 1000),
      },
      select: { id: true },
    });
    const atNextStart = await prisma.lesson.create({
      data: {
        ...template,
        type: "SEMINAR",
        subgroup: "ALL",
        startsAt: nextWeekStart,
        endsAt: new Date(nextWeekStart.getTime() + 90 * 60 * 1000),
      },
      select: { id: true },
    });

    try {
      const week = await getWeekSchedule(annaId, weekStart);
      const weekLessons = week?.days.flatMap((day) => day.lessons) ?? [];

      expect(week?.weekStart).toBe(getMoscowDateKey(weekStart));
      expect(weekLessons.some((lesson) => lesson.id === atStart.id)).toBe(true);
      expect(weekLessons.some((lesson) => lesson.id === atNextStart.id)).toBe(false);

      const nextWeek = await getWeekSchedule(annaId, nextWeekStart);
      const nextWeekLessons = nextWeek?.days.flatMap((day) => day.lessons) ?? [];

      expect(nextWeek?.weekStart).toBe(getMoscowDateKey(nextWeekStart));
      expect(nextWeekLessons.some((lesson) => lesson.id === atNextStart.id)).toBe(true);
      expect(nextWeekLessons.some((lesson) => lesson.id === atStart.id)).toBe(false);

      const day = await getTodaySchedule(annaId, weekStart);
      expect(day?.date).toBe(getMoscowDateKey(weekStart));
      expect(day?.lessons.some((lesson) => lesson.id === atStart.id)).toBe(true);
    } finally {
      await prisma.lesson.deleteMany({
        where: { id: { in: [atStart.id, atNextStart.id] } },
      });
    }
  });

  it("переносит занятие через границу недели и не теряет изменение", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const template = await getLessonTemplate();
    const weekAStart = startOfMoscowWeek(new Date("2032-03-01T12:00:00.000Z"));
    const weekBStart = addMoscowDays(weekAStart, 7);
    const originalStart = new Date(addMoscowDays(weekAStart, 1).getTime() + 9 * HOUR_MS);

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
          reason: "Перенос на следующую неделю",
          newStartsAt: weekBStart,
          newEndsAt: new Date(weekBStart.getTime() + 90 * 60 * 1000),
        },
      });

      const weekA = await getWeekSchedule(annaId, noonOf(weekAStart));
      expect(weekA?.days.flatMap((day) => day.lessons).some((item) => item.id === lesson.id)).toBe(
        false,
      );

      const weekB = await getWeekSchedule(annaId, noonOf(weekBStart));
      const moved = weekB?.days[0]?.lessons.find((item) => item.id === lesson.id);

      expect(moved?.effective.startsAt.getTime()).toBe(weekBStart.getTime());
      expect(moved?.changes.some((change) => change.type === "TIME_CHANGE")).toBe(true);

      const day = await getTodaySchedule(annaId, weekBStart);
      expect(day?.lessons.some((item) => item.id === lesson.id)).toBe(true);
    } finally {
      await prisma.lesson.deleteMany({ where: { id: lesson.id } });
    }
  });

  it("относит воскресенье к неделе с понедельника", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");
    const sunday = addMoscowDays(weekStart, 6);

    const week = await getWeekSchedule(annaId, noonOf(sunday));

    expect(week?.weekStart).toBe(getMoscowDateKey(weekStart));
    expect(week?.days[6]?.date).toBe(getMoscowDateKey(sunday));
  });

  it("оставляет поздний вечер по Москве в текущем дне", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");
    const mondayLate = new Date(addMoscowDays(weekStart, 1).getTime() - 60 * 1000);

    const day = await getTodaySchedule(annaId, mondayLate);

    expect(day?.date).toBe(getMoscowDateKey(weekStart));
  });

  it("не теряет в недельном расписании изменения всех пяти типов", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const weekStart = await getGroupWeekStart("MO-21-4");

    const week = await getWeekSchedule(annaId, noonOf(weekStart));
    const changes =
      week?.days.flatMap((day) => day.lessons.flatMap((lesson) => lesson.changes)) ?? [];
    const types = [...new Set(changes.map((change) => change.type))].sort();

    expect(types).toEqual([
      "CANCELLATION",
      "LESSON_REPLACEMENT",
      "ROOM_CHANGE",
      "TEACHER_CHANGE",
      "TIME_CHANGE",
    ]);
    expect(changes.every((change) => Boolean(change.reason?.trim()))).toBe(true);

    const timeChange = changes.find((change) => change.type === "TIME_CHANGE");
    expect(timeChange?.newStartsAt).toBeInstanceOf(Date);
    expect(timeChange?.newEndsAt).toBeInstanceOf(Date);

    const roomChange = changes.find((change) => change.type === "ROOM_CHANGE");
    expect(roomChange?.newRoom).not.toBeNull();

    const teacherChange = changes.find((change) => change.type === "TEACHER_CHANGE");
    expect(teacherChange?.newTeacher).not.toBeNull();

    const replacement = changes.find((change) => change.type === "LESSON_REPLACEMENT");
    expect(replacement?.replacementDiscipline).not.toBeNull();
  });
});
