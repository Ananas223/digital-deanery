import { afterAll, describe, expect, it } from "vitest";

import type { LessonChangeType, LessonSubgroup } from "@/generated/prisma/enums";
import { createPrismaClient } from "@/lib/db/client";
import { getLessonCard } from "@/lib/domain/schedule";

const prisma = createPrismaClient();

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

async function findLesson(
  groupCode: string,
  disciplineCode: string,
  subgroup: LessonSubgroup,
): Promise<string> {
  const lesson = await prisma.lesson.findFirst({
    where: {
      group: { code: groupCode },
      discipline: { code: disciplineCode },
      subgroup,
    },
    orderBy: { startsAt: "asc" },
    select: { id: true },
  });

  if (!lesson) {
    throw new Error(
      `Занятие ${groupCode}/${disciplineCode}/${subgroup} не найдено; проверьте seed.`,
    );
  }

  return lesson.id;
}

describe("карточка занятия", () => {
  it("возвращает карточку общего занятия Анны с исходными данными и отменой", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const lessonId = await findLesson("MO-21-4", "MO-101", "ALL");

    const card = await getLessonCard(annaId, lessonId);

    expect(card).not.toBeNull();
    expect(card?.groupCode).toBe("MO-21-4");
    expect(card?.type).toBe("LECTURE");
    expect(card?.original.startsAt).toBeInstanceOf(Date);
    expect(card?.original.endsAt).toBeInstanceOf(Date);
    expect(card?.original.discipline).toMatchObject({
      code: "MO-101",
      name: expect.any(String),
      id: expect.any(String),
    });
    expect(card?.original.teacher).toMatchObject({
      fullName: expect.any(String),
      id: expect.any(String),
    });
    expect(card?.original.room).toMatchObject({
      number: expect.any(String),
      id: expect.any(String),
      building: {
        id: expect.any(String),
        code: expect.any(String),
        name: expect.any(String),
      },
    });
    expect(card?.changes.length).toBeGreaterThan(0);
    expect(card?.changes[0]?.reason).toBeTruthy();
    expect(card?.effective.status).toBe("CANCELLED");
  });

  it("скрывает занятие другой группы", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const markLessonId = await findLesson("MEO-11-2", "MEO-101", "ALL");

    await expect(getLessonCard(annaId, markLessonId)).resolves.toBeNull();
  });

  it("соблюдает изоляцию по подгруппам", async () => {
    const annaId = await findStudent("anna.petrova@example.com");
    const markId = await findStudent("mark.sokolov@example.com");

    const moFirst = await findLesson("MO-21-4", "MO-103", "FIRST");
    const moSecond = await findLesson("MO-21-4", "MO-103", "SECOND");
    const meoFirst = await findLesson("MEO-11-2", "MEO-103", "FIRST");
    const meoSecond = await findLesson("MEO-11-2", "MEO-103", "SECOND");

    await expect(getLessonCard(annaId, moFirst)).resolves.not.toBeNull();
    await expect(getLessonCard(annaId, moSecond)).resolves.toBeNull();
    await expect(getLessonCard(markId, meoSecond)).resolves.not.toBeNull();
    await expect(getLessonCard(markId, meoFirst)).resolves.toBeNull();
  });

  it.each([
    "CANCELLATION",
    "TIME_CHANGE",
    "ROOM_CHANGE",
    "TEACHER_CHANGE",
    "LESSON_REPLACEMENT",
  ] as LessonChangeType[])(
    "применяет изменение типа %s и сохраняет причины в хронологическом порядке",
    async (type) => {
      const annaId = await findStudent("anna.petrova@example.com");
      const lesson = await prisma.lesson.findFirst({
        where: {
          group: { code: "MO-21-4" },
          changes: { some: { type } },
        },
        select: { id: true },
      });

      expect(lesson).not.toBeNull();

      const card = await getLessonCard(annaId, lesson!.id);

      expect(card).not.toBeNull();
      expect(card?.changes.length).toBeGreaterThan(0);
      for (const change of card!.changes) {
        expect(change.reason?.trim()).toBeTruthy();
      }

      const createdAtMs = card!.changes.map((change) => change.createdAt.getTime());
      const sorted = [...createdAtMs].sort((a, b) => a - b);
      expect(createdAtMs).toEqual(sorted);

      const applied = card!.changes.find((change) => change.type === type);
      expect(applied).toBeDefined();

      switch (type) {
        case "CANCELLATION":
          expect(card?.effective.status).toBe("CANCELLED");
          break;
        case "TIME_CHANGE":
          expect(applied?.newStartsAt).not.toBeNull();
          expect(applied?.newEndsAt).not.toBeNull();
          expect(card?.effective.startsAt).toEqual(applied?.newStartsAt);
          expect(card?.effective.endsAt).toEqual(applied?.newEndsAt);
          expect(card?.effective.startsAt.getTime()).not.toBe(card?.original.startsAt.getTime());
          expect(card?.effective.endsAt.getTime()).not.toBe(card?.original.endsAt.getTime());
          break;
        case "ROOM_CHANGE":
          expect(applied?.newRoom?.id).toBeTruthy();
          expect(card?.effective.room.id).toBe(applied?.newRoom?.id);
          expect(card?.effective.room.id).not.toBe(card?.original.room.id);
          break;
        case "TEACHER_CHANGE":
          expect(applied?.newTeacher?.id).toBeTruthy();
          expect(card?.effective.teacher.id).toBe(applied?.newTeacher?.id);
          expect(card?.effective.teacher.id).not.toBe(card?.original.teacher.id);
          break;
        case "LESSON_REPLACEMENT":
          expect(applied?.replacementDiscipline?.id).toBeTruthy();
          expect(card?.effective.discipline.id).toBe(applied?.replacementDiscipline?.id);
          expect(card?.effective.discipline.id).not.toBe(card?.original.discipline.id);
          break;
      }
    },
  );

  it("возвращает null для неизвестного занятия и неизвестного пользователя", async () => {
    const annaId = await findStudent("anna.petrova@example.com");

    await expect(getLessonCard(annaId, "unknown-lesson-id")).resolves.toBeNull();
    await expect(getLessonCard("nonexistent-user-id", "any-lesson")).resolves.toBeNull();
  });
});
