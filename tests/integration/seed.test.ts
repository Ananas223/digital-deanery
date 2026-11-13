import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const prisma = createPrismaClient();

/** Демонстрационный пароль из seed; в БД должен храниться только scrypt-хеш. */
const DEMO_PASSWORD = "Deanery#2026";

const EXPECTED_STUDENTS = [
  {
    email: "anna.petrova@example.com",
    name: "Анна Петрова",
    groupCode: "MO-21-4",
    course: 2,
  },
  {
    email: "mark.sokolov@example.com",
    name: "Марк Соколов",
    groupCode: "MEO-11-2",
    course: 1,
  },
] as const;

function runSeed(): void {
  execFileSync(path.resolve(rootDir, "node_modules/.bin/tsx"), ["prisma/seed.ts"], {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: process.env["DATABASE_URL"] },
    stdio: "pipe",
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed тестовой базы", () => {
  it("создаёт ровно двух демо-студентов", async () => {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { email: true, name: true, role: true },
    });

    expect(users).toHaveLength(2);
    expect(users.map((user) => user.email)).toEqual([
      "anna.petrova@example.com",
      "mark.sokolov@example.com",
    ]);
    expect(users.every((user) => user.role === "STUDENT")).toBe(true);
  });

  it("создаёт профили с ожидаемыми группами и курсами", async () => {
    for (const expected of EXPECTED_STUDENTS) {
      const user = await prisma.user.findUnique({
        where: { email: expected.email },
        select: {
          name: true,
          studentProfile: {
            select: {
              course: true,
              group: { select: { code: true } },
              faculty: { select: { code: true } },
              program: { select: { code: true } },
            },
          },
        },
      });

      expect(user?.name).toBe(expected.name);
      expect(user?.studentProfile).not.toBeNull();
      expect(user?.studentProfile?.course).toBe(expected.course);
      expect(user?.studentProfile?.group.code).toBe(expected.groupCode);
      expect(user?.studentProfile?.faculty.code).toBeTruthy();
      expect(user?.studentProfile?.program.code).toBeTruthy();
    }
  });

  it("хранит пароль только как хеш Better Auth", async () => {
    const accounts = await prisma.account.findMany({
      select: { providerId: true, password: true, userId: true },
    });

    expect(accounts).toHaveLength(2);

    for (const account of accounts) {
      expect(account.providerId).toBe("credential");
      expect(account.password).toBeTruthy();
      expect(account.password).not.toBe(DEMO_PASSWORD);
      expect(account.password).not.toContain(DEMO_PASSWORD);
      // scrypt-хеш Better Auth не похож на открытый текст.
      expect(account.password?.length ?? 0).toBeGreaterThan(32);
    }
  });

  it("повторный seed идемпотентен и не создаёт дублей", async () => {
    const before = {
      users: await prisma.user.count(),
      profiles: await prisma.studentProfile.count(),
      accounts: await prisma.account.count(),
    };

    runSeed();

    const after = {
      users: await prisma.user.count(),
      profiles: await prisma.studentProfile.count(),
      accounts: await prisma.account.count(),
    };

    expect(before).toEqual({ users: 2, profiles: 2, accounts: 2 });
    expect(after).toEqual(before);
  });
});
