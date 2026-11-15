import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import {
  getSemesterLabel,
  getSemesterOverview,
  getSemesters,
  type Semester,
} from "@/lib/domain/grades";

const prisma = createPrismaClient();

/** Фиксированное «сейчас» внутри текущего тестового семестра. */
const NOW = new Date("2030-10-15T09:00:00.000Z");

const CURRENT_YEAR = "2099/2100";
const PAST_YEAR = "2098/2099";
const EMPTY_YEAR = "2097/2098";

type Fixture = {
  annaId: string;
  markId: string;
  currentSemesterId: string;
  pastSemesterId: string;
  emptySemesterId: string;
};

let fixture: Fixture;
let createdSemesterIds: string[] = [];

afterAll(async () => {
  if (createdSemesterIds.length > 0) {
    await prisma.exam.deleteMany({ where: { semesterId: { in: createdSemesterIds } } });
    await prisma.grade.deleteMany({ where: { semesterId: { in: createdSemesterIds } } });
    await prisma.semester.deleteMany({ where: { id: { in: createdSemesterIds } } });
  }

  await prisma.$disconnect();
});

async function findStudent(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (!user) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return user.id;
}

async function getProfile(userId: string): Promise<{ id: string; groupId: string }> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true, groupId: true },
  });

  if (!profile) {
    throw new Error("Демо-профиль не найден; проверьте seed.");
  }

  return profile;
}

async function getDisciplineIds(codes: readonly string[]): Promise<Map<string, string>> {
  const disciplines = await prisma.discipline.findMany({
    where: { code: { in: [...codes] } },
    select: { id: true, code: true },
  });

  return new Map(disciplines.map((discipline) => [discipline.code, discipline.id]));
}

beforeAll(async () => {
  const [annaId, markId] = await Promise.all([
    findStudent("anna.petrova@example.com"),
    findStudent("mark.sokolov@example.com"),
  ]);
  const [annaProfile, markProfile] = await Promise.all([getProfile(annaId), getProfile(markId)]);

  const semesters = await Promise.all([
    prisma.semester.create({
      data: {
        academicYear: CURRENT_YEAR,
        term: "AUTUMN",
        startsAt: new Date("2030-09-01T00:00:00.000Z"),
        endsAt: new Date("2030-12-31T23:59:59.000Z"),
      },
      select: { id: true },
    }),
    prisma.semester.create({
      data: {
        academicYear: PAST_YEAR,
        term: "SPRING",
        startsAt: new Date("2030-02-01T00:00:00.000Z"),
        endsAt: new Date("2030-06-30T23:59:59.000Z"),
      },
      select: { id: true },
    }),
    prisma.semester.create({
      data: {
        academicYear: EMPTY_YEAR,
        term: "SPRING",
        startsAt: new Date("2029-02-01T00:00:00.000Z"),
        endsAt: new Date("2029-06-30T23:59:59.000Z"),
      },
      select: { id: true },
    }),
  ]);

  const [current, past, empty] = semesters;

  if (!current || !past || !empty) {
    throw new Error("Не удалось создать тестовые семестры.");
  }

  const disciplines = await getDisciplineIds(["MO-101", "MO-102", "MO-103", "MO-104", "MO-105"]);
  const disciplineId = (code: string): string => {
    const id = disciplines.get(code);
    if (!id) {
      throw new Error(`Дисциплина ${code} не найдена; проверьте seed.`);
    }
    return id;
  };

  const room = await prisma.room.findFirst({
    where: { building: { code: "A" }, number: "203" },
    select: { id: true },
  });
  const teacher = await prisma.discipline.findUnique({
    where: { code: "MO-101" },
    select: { teacherId: true },
  });

  await prisma.grade.createMany({
    data: [
      {
        studentProfileId: annaProfile.id,
        disciplineId: disciplineId("MO-101"),
        semesterId: current.id,
        assessmentType: "EXAM",
        credits: 4,
        score: 5,
        status: "PASSED",
      },
      {
        studentProfileId: annaProfile.id,
        disciplineId: disciplineId("MO-102"),
        semesterId: current.id,
        assessmentType: "CREDIT",
        credits: 2,
        score: null,
        status: "PASSED",
      },
      {
        studentProfileId: annaProfile.id,
        disciplineId: disciplineId("MO-103"),
        semesterId: current.id,
        assessmentType: "EXAM",
        credits: 3,
        score: null,
        status: "NOT_GRADED",
      },
      {
        studentProfileId: annaProfile.id,
        disciplineId: disciplineId("MO-105"),
        semesterId: past.id,
        assessmentType: "GRADED_CREDIT",
        credits: 4,
        score: 4,
        status: "PASSED",
      },
      {
        studentProfileId: markProfile.id,
        disciplineId: disciplineId("MO-104"),
        semesterId: current.id,
        assessmentType: "EXAM",
        credits: 3,
        score: 3,
        status: "PASSED",
      },
    ],
  });

  await prisma.exam.create({
    data: {
      groupId: annaProfile.groupId,
      disciplineId: disciplineId("MO-101"),
      semesterId: current.id,
      assessmentType: "EXAM",
      startsAt: new Date("2030-12-20T06:00:00.000Z"),
      endsAt: new Date("2030-12-20T08:30:00.000Z"),
      ...(room ? { roomId: room.id } : {}),
      ...(teacher?.teacherId ? { teacherId: teacher.teacherId } : {}),
    },
  });

  // Экзамен чужой группы не должен попадать в сессию Анны.
  await prisma.exam.create({
    data: {
      groupId: markProfile.groupId,
      disciplineId: disciplineId("MO-104"),
      semesterId: current.id,
      assessmentType: "EXAM",
      startsAt: new Date("2030-12-21T06:00:00.000Z"),
      endsAt: new Date("2030-12-21T08:30:00.000Z"),
    },
  });

  fixture = {
    annaId,
    markId,
    currentSemesterId: current.id,
    pastSemesterId: past.id,
    emptySemesterId: empty.id,
  };
  createdSemesterIds = [current.id, past.id, empty.id];
});

describe("семестры успеваемости", () => {
  it("отдаёт семестры от нового к старому и отмечает текущий по датам", async () => {
    const semesters = await getSemesters(fixture.annaId, NOW);

    expect(semesters.slice(0, 3).map((semester) => semester.id)).toEqual([
      fixture.currentSemesterId,
      fixture.pastSemesterId,
      fixture.emptySemesterId,
    ]);
    expect(semesters[0]?.isCurrent).toBe(true);
    expect(semesters[1]?.isCurrent).toBe(false);
    expect(getSemesterLabel(semesters[0] as Semester)).toBe(`Осенний семестр ${CURRENT_YEAR}`);
  });

  it("возвращает пустой список без академического профиля", async () => {
    await expect(getSemesters("no-such-user", NOW)).resolves.toEqual([]);
  });
});

describe("успеваемость за семестр", () => {
  it("по умолчанию выбирает текущий семестр и сортирует дисциплины по названию", async () => {
    const overview = await getSemesterOverview(fixture.annaId, undefined, NOW);

    expect(overview?.semester.id).toBe(fixture.currentSemesterId);
    expect(overview?.semester.isCurrent).toBe(true);
    expect(overview?.grades.map((grade) => grade.discipline.code)).toEqual([
      "MO-103",
      "MO-101",
      "MO-102",
    ]);

    const history = overview?.grades.find((grade) => grade.discipline.code === "MO-101");
    expect(history).toMatchObject({
      assessmentType: "EXAM",
      credits: 4,
      score: 5,
      status: "PASSED",
    });
    expect(history?.teacherName).toBe("Ирина Владимировна Соколова");

    const credit = overview?.grades.find((grade) => grade.discipline.code === "MO-102");
    expect(credit).toMatchObject({ assessmentType: "CREDIT", score: null, status: "PASSED" });

    const pending = overview?.grades.find((grade) => grade.discipline.code === "MO-103");
    expect(pending?.status).toBe("NOT_GRADED");
  });

  it("отдаёт прошлый семестр по идентификатору", async () => {
    const overview = await getSemesterOverview(fixture.annaId, fixture.pastSemesterId, NOW);

    expect(overview?.semester.academicYear).toBe(PAST_YEAR);
    expect(overview?.semester.isCurrent).toBe(false);
    expect(overview?.grades).toHaveLength(1);
    expect(overview?.grades[0]).toMatchObject({
      assessmentType: "GRADED_CREDIT",
      credits: 4,
      score: 4,
      status: "PASSED",
    });
  });

  it("не показывает оценки другого студента", async () => {
    const mark = await getSemesterOverview(fixture.markId, fixture.currentSemesterId, NOW);

    expect(mark?.grades).toHaveLength(1);
    expect(mark?.grades[0]?.discipline.code).toBe("MO-104");
    expect(mark?.grades.some((grade) => grade.discipline.code === "MO-101")).toBe(false);
  });

  it("возвращает пустой семестр без оценок и сессии", async () => {
    const overview = await getSemesterOverview(fixture.annaId, fixture.emptySemesterId, NOW);

    expect(overview?.semester.id).toBe(fixture.emptySemesterId);
    expect(overview?.grades).toEqual([]);
    expect(overview?.session).toEqual([]);
  });

  it("возвращает null для несуществующего семестра и пользователя без профиля", async () => {
    await expect(getSemesterOverview(fixture.annaId, "no-such-semester", NOW)).resolves.toBeNull();
    await expect(getSemesterOverview("no-such-user", undefined, NOW)).resolves.toBeNull();
  });
});

describe("сессия семестра", () => {
  it("показывает экзамены своей группы с аудиторией и результатом", async () => {
    const overview = await getSemesterOverview(fixture.annaId, fixture.currentSemesterId, NOW);

    expect(overview?.session).toHaveLength(1);
    const exam = overview?.session[0];

    expect(exam?.discipline.code).toBe("MO-101");
    expect(exam?.assessmentType).toBe("EXAM");
    expect(exam?.teacherName).toBe("Ирина Владимировна Соколова");
    expect(exam?.room).toEqual({ buildingCode: "A", number: "203", name: "Аудитория 203" });
    expect(exam?.result).toEqual({ score: 5, status: "PASSED" });
  });

  it("не показывает сессию другой группы", async () => {
    const mark = await getSemesterOverview(fixture.markId, fixture.currentSemesterId, NOW);

    expect(mark?.session).toHaveLength(1);
    expect(mark?.session[0]?.discipline.code).toBe("MO-104");
    expect(mark?.session.some((exam) => exam.discipline.code === "MO-101")).toBe(false);
  });
});
