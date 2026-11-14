import { describe, expect, it } from "vitest";

import {
  getLessonChangeLabel,
  resolveLessonState,
  sortLessonChanges,
  type LessonChangeInput,
  type LessonSnapshot,
  type ScheduleDiscipline,
  type ScheduleRoom,
  type ScheduleTeacher,
} from "@/lib/domain/schedule-changes";

const building = { id: "b-1", code: "GL", name: "Главный корпус" };

const disciplineA: ScheduleDiscipline = {
  id: "d-1",
  code: "MO-101",
  name: "Дисциплина A",
};
const disciplineB: ScheduleDiscipline = {
  id: "d-2",
  code: "MO-102",
  name: "Дисциплина B",
};

const teacherA: ScheduleTeacher = { id: "t-1", fullName: "Преподаватель A" };
const teacherB: ScheduleTeacher = { id: "t-2", fullName: "Преподаватель B" };

const roomA: ScheduleRoom = {
  id: "r-1",
  number: "101",
  name: "Аудитория 101",
  building,
};
const roomB: ScheduleRoom = {
  id: "r-2",
  number: "202",
  name: "Аудитория 202",
  building,
};

function makeOriginal(overrides: Partial<LessonSnapshot> = {}): LessonSnapshot {
  return {
    startsAt: new Date("2026-03-02T08:00:00.000Z"),
    endsAt: new Date("2026-03-02T09:30:00.000Z"),
    discipline: disciplineA,
    teacher: teacherA,
    room: roomA,
    ...overrides,
  };
}

function makeChange(
  overrides: Partial<LessonChangeInput> &
    Pick<LessonChangeInput, "id" | "type" | "createdAt">,
): LessonChangeInput {
  return {
    reason: null,
    newStartsAt: null,
    newEndsAt: null,
    newRoom: null,
    newTeacher: null,
    replacementDiscipline: null,
    ...overrides,
  };
}

describe("изменения расписания", () => {
  it("без изменений возвращает исходные значения и статус SCHEDULED", () => {
    const original = makeOriginal();

    const effective = resolveLessonState(original, []);

    expect(effective).toEqual({ ...original, status: "SCHEDULED" });
    expect(effective.startsAt).toBe(original.startsAt);
    expect(effective.discipline).toBe(original.discipline);
  });

  it("CANCELLATION переводит занятие в статус CANCELLED", () => {
    const effective = resolveLessonState(makeOriginal(), [
      makeChange({
        id: "c-1",
        type: "CANCELLATION",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        reason: "Преподаватель на больничном",
      }),
    ]);

    expect(effective.status).toBe("CANCELLED");
  });

  it("TIME_CHANGE применяет новое время, если обе границы заданы", () => {
    const newStartsAt = new Date("2026-03-02T10:00:00.000Z");
    const newEndsAt = new Date("2026-03-02T11:30:00.000Z");

    const effective = resolveLessonState(makeOriginal(), [
      makeChange({
        id: "c-2",
        type: "TIME_CHANGE",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        newStartsAt,
        newEndsAt,
      }),
    ]);

    expect(effective.startsAt).toBe(newStartsAt);
    expect(effective.endsAt).toBe(newEndsAt);
  });

  it("TIME_CHANGE с null newStartsAt или null newEndsAt игнорируется", () => {
    const original = makeOriginal();

    const onlyStart = resolveLessonState(original, [
      makeChange({
        id: "c-3",
        type: "TIME_CHANGE",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        newStartsAt: new Date("2026-03-02T10:00:00.000Z"),
        newEndsAt: null,
      }),
    ]);
    const onlyEnd = resolveLessonState(original, [
      makeChange({
        id: "c-4",
        type: "TIME_CHANGE",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        newStartsAt: null,
        newEndsAt: new Date("2026-03-02T11:30:00.000Z"),
      }),
    ]);

    expect(onlyStart.startsAt).toBe(original.startsAt);
    expect(onlyStart.endsAt).toBe(original.endsAt);
    expect(onlyEnd.startsAt).toBe(original.startsAt);
    expect(onlyEnd.endsAt).toBe(original.endsAt);
  });

  it("ROOM_CHANGE применяет новую аудиторию", () => {
    const effective = resolveLessonState(makeOriginal(), [
      makeChange({
        id: "c-5",
        type: "ROOM_CHANGE",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        newRoom: roomB,
      }),
    ]);

    expect(effective.room).toBe(roomB);
  });

  it("TEACHER_CHANGE применяет нового преподавателя", () => {
    const effective = resolveLessonState(makeOriginal(), [
      makeChange({
        id: "c-6",
        type: "TEACHER_CHANGE",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        newTeacher: teacherB,
      }),
    ]);

    expect(effective.teacher).toBe(teacherB);
  });

  it("LESSON_REPLACEMENT применяет заменяющую дисциплину", () => {
    const effective = resolveLessonState(makeOriginal(), [
      makeChange({
        id: "c-7",
        type: "LESSON_REPLACEMENT",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        replacementDiscipline: disciplineB,
      }),
    ]);

    expect(effective.discipline).toBe(disciplineB);
  });

  it("более позднее изменение того же аспекта побеждает", () => {
    const earlyRoom = { ...roomB, id: "r-early" };
    const lateRoom = { ...roomB, id: "r-late", number: "303" };

    const effective = resolveLessonState(makeOriginal(), [
      makeChange({
        id: "c-8",
        type: "ROOM_CHANGE",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        newRoom: lateRoom,
      }),
      makeChange({
        id: "c-9",
        type: "ROOM_CHANGE",
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
        newRoom: earlyRoom,
      }),
    ]);

    expect(effective.room).toBe(lateRoom);
  });

  it("CANCELLATION терминальна, даже если позже есть TIME_CHANGE", () => {
    const original = makeOriginal();
    const effective = resolveLessonState(original, [
      makeChange({
        id: "c-10",
        type: "CANCELLATION",
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
      }),
      makeChange({
        id: "c-11",
        type: "TIME_CHANGE",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        newStartsAt: new Date("2026-03-02T10:00:00.000Z"),
        newEndsAt: new Date("2026-03-02T11:30:00.000Z"),
      }),
    ]);

    expect(effective.status).toBe("CANCELLED");
    expect(effective.startsAt).toEqual(new Date("2026-03-02T10:00:00.000Z"));
    expect(effective.endsAt).toEqual(new Date("2026-03-02T11:30:00.000Z"));
  });

  it("sortLessonChanges сортирует по createdAt, затем по id, и не мутирует вход", () => {
    const first = makeChange({
      id: "b-id",
      type: "ROOM_CHANGE",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    });
    const second = makeChange({
      id: "a-id",
      type: "ROOM_CHANGE",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    });
    const third = makeChange({
      id: "c-id",
      type: "ROOM_CHANGE",
      createdAt: new Date("2026-03-01T11:00:00.000Z"),
    });
    const input = [third, first, second];

    const sorted = sortLessonChanges(input);

    expect(sorted).toEqual([second, first, third]);
    expect(sorted).not.toBe(input);
    expect(input).toEqual([third, first, second]);
  });

  it("getLessonChangeLabel возвращает все пять русских подписей", () => {
    expect(getLessonChangeLabel("CANCELLATION")).toBe("Отмена");
    expect(getLessonChangeLabel("TIME_CHANGE")).toBe("Перенос времени");
    expect(getLessonChangeLabel("ROOM_CHANGE")).toBe("Смена аудитории");
    expect(getLessonChangeLabel("TEACHER_CHANGE")).toBe("Замена преподавателя");
    expect(getLessonChangeLabel("LESSON_REPLACEMENT")).toBe("Замена занятия");
  });
});
