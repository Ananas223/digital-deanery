import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import { getStudentProfile } from "@/lib/domain/profile";

const prisma = createPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

async function findUserId(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (!user) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return user.id;
}

describe("профиль студента", () => {
  it("возвращает академические данные Анны из базы", async () => {
    const profile = await getStudentProfile(await findUserId("anna.petrova@example.com"));

    expect(profile).toMatchObject({
      fullName: "Анна Петрова",
      email: "anna.petrova@example.com",
      faculty: "Факультет международных отношений",
      program: "Международные отношения",
      group: "MO-21-4",
      course: 2,
      studyForm: "BUDGET",
      studentNumber: "MO-21-0047",
    });
  });

  it("возвращает другие данные для Марка", async () => {
    const anna = await getStudentProfile(await findUserId("anna.petrova@example.com"));
    const mark = await getStudentProfile(await findUserId("mark.sokolov@example.com"));

    expect(mark).toMatchObject({
      fullName: "Марк Соколов",
      email: "mark.sokolov@example.com",
      faculty: "Факультет международных экономических отношений",
      program: "Мировая экономика",
      group: "MEO-11-2",
      course: 1,
      studyForm: "PAID",
      studentNumber: "MEO-11-0112",
    });

    expect(mark?.email).not.toBe(anna?.email);
    expect(mark?.studentNumber).not.toBe(anna?.studentNumber);
    expect(mark?.group).not.toBe(anna?.group);
  });

  it("не отдаёт профиль по неизвестному идентификатору", async () => {
    await expect(getStudentProfile("nonexistent-user-id")).resolves.toBeNull();
  });
});
