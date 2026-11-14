import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";

const prisma = createPrismaClient();

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

afterAll(async () => {
  await prisma.$disconnect();
});

/** День недели по московскому времени: 0 — воскресенье. */
function moscowWeekday(date: Date): number {
  return new Date(date.getTime() + MSK_OFFSET_MS).getUTCDay();
}

async function getGroupSchedule(code: string) {
  const group = await prisma.group.findUnique({
    where: { code },
    select: {
      id: true,
      lessons: {
        orderBy: { startsAt: "asc" },
        select: {
          startsAt: true,
          endsAt: true,
          subgroup: true,
          type: true,
          discipline: { select: { code: true, name: true } },
          teacher: { select: { fullName: true } },
          room: {
            select: {
              number: true,
              building: { select: { code: true, name: true } },
            },
          },
          changes: {
            select: { type: true, reason: true },
          },
        },
      },
    },
  });

  if (!group) {
    throw new Error(`Группа ${code} не найдена; проверьте seed.`);
  }

  return group;
}

describe("демонстрационное расписание", () => {
  it("содержит занятия двух разных групп с полными данными", async () => {
    const annaGroup = await getGroupSchedule("MO-21-4");
    const markGroup = await getGroupSchedule("MEO-11-2");

    expect(annaGroup.lessons).toHaveLength(17);
    expect(markGroup.lessons).toHaveLength(12);

    for (const lesson of [...annaGroup.lessons, ...markGroup.lessons]) {
      expect(lesson.endsAt.getTime()).toBeGreaterThan(lesson.startsAt.getTime());
      expect(lesson.discipline.name.length).toBeGreaterThan(0);
      expect(lesson.teacher.fullName.length).toBeGreaterThan(0);
      expect(lesson.room.number.length).toBeGreaterThan(0);
      expect(lesson.room.building.name.length).toBeGreaterThan(0);
    }

    const annaDisciplines = new Set(annaGroup.lessons.map((lesson) => lesson.discipline.code));
    const markDisciplines = new Set(markGroup.lessons.map((lesson) => lesson.discipline.code));

    expect([...annaDisciplines].every((code) => code.startsWith("MO-"))).toBe(true);
    expect([...markDisciplines].every((code) => code.startsWith("MEO-"))).toBe(true);
  });

  it("позволяет отфильтровать занятия чужой подгруппы", async () => {
    const annaGroup = await getGroupSchedule("MO-21-4");
    const markGroup = await getGroupSchedule("MEO-11-2");

    const annaVisible = annaGroup.lessons.filter(
      (lesson) => lesson.subgroup === "ALL" || lesson.subgroup === "FIRST",
    );
    const annaHidden = annaGroup.lessons.filter((lesson) => lesson.subgroup === "SECOND");

    const markVisible = markGroup.lessons.filter(
      (lesson) => lesson.subgroup === "ALL" || lesson.subgroup === "SECOND",
    );
    const markHidden = markGroup.lessons.filter((lesson) => lesson.subgroup === "FIRST");

    expect(annaVisible.length).toBeGreaterThan(0);
    expect(markVisible.length).toBeGreaterThan(0);
    expect(annaHidden.length).toBeGreaterThan(0);
    expect(markHidden.length).toBeGreaterThan(0);
    expect(annaVisible.length + annaHidden.length).toBe(annaGroup.lessons.length);
    expect(markVisible.length + markHidden.length).toBe(markGroup.lessons.length);
  });

  it("оставляет воскресенье пустым для обоих студентов", async () => {
    const annaGroup = await getGroupSchedule("MO-21-4");
    const markGroup = await getGroupSchedule("MEO-11-2");

    const sundayLessons = [...annaGroup.lessons, ...markGroup.lessons].filter(
      (lesson) => moscowWeekday(lesson.startsAt) === 0,
    );

    expect(sundayLessons).toEqual([]);
  });

  it("хранит изменения всех пяти типов и объясняет каждое", async () => {
    const annaGroup = await getGroupSchedule("MO-21-4");
    const markGroup = await getGroupSchedule("MEO-11-2");

    const changes = [...annaGroup.lessons, ...markGroup.lessons].flatMap(
      (lesson) => lesson.changes,
    );

    expect(new Set(changes.map((change) => change.type))).toEqual(
      new Set([
        "CANCELLATION",
        "TIME_CHANGE",
        "ROOM_CHANGE",
        "TEACHER_CHANGE",
        "LESSON_REPLACEMENT",
      ]),
    );
    expect(changes.every((change) => Boolean(change.reason?.trim()))).toBe(true);
  });
});
