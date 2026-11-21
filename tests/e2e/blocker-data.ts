import { randomUUID } from "node:crypto";

import { createPrismaClient } from "../../src/lib/db/client";

const DAY = 86_400_000;
const fixturePrefix = "e2e-v4-blocker:";

async function run() {
  const database = process.env["DATABASE_URL_TEST"];
  if (
    !database ||
    !decodeURIComponent(new URL(database).pathname).endsWith("_test") ||
    process.env["DATABASE_URL"] !== database
  ) {
    throw new Error("Для браузерных фикстур требуется отдельная тестовая база.");
  }
  const [action, key, ...emails] = process.argv.slice(2);
  const prisma = createPrismaClient();
  try {
    if (action === "catalog") {
      return await prisma.requestType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { code: true, title: true, description: true, processingDays: true },
      });
    }
    if (!key || !/^[a-f0-9-]{36}$/.test(key)) throw new Error("Некорректный ключ фикстуры.");
    const fixtureKey = `${fixturePrefix}${key}`;
    if (action === "clean-session") {
      return await prisma.semester.deleteMany({ where: { academicYear: fixtureKey } });
    }
    if (action === "clean-notices") {
      return await prisma.notification.deleteMany({
        where: { dedupeKey: { startsWith: `${fixtureKey}:` } },
      });
    }
    if (action === "pending-session" && emails.length === 1) {
      const { groupId } = await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: emails[0]! } },
        select: { groupId: true },
      });
      const now = Date.now();
      const expectedAt = new Date(now + 7 * DAY);
      const { id } = await prisma.semester.create({
        data: {
          academicYear: fixtureKey,
          term: "AUTUMN",
          startsAt: new Date(now + DAY),
          endsAt: new Date(now + 40 * DAY),
          sessionPublications: { create: { groupId, expectedAt } },
        },
      });
      return { id, expectedAt };
    }
    if (action === "archived-notices" && emails.length === 2) {
      const profiles = await prisma.studentProfile.findMany({
        where: { user: { email: { in: emails } } },
        select: { id: true, user: { select: { email: true } } },
      });
      if (profiles.length !== emails.length) throw new Error("Не найдены демо-профили.");
      const now = Date.now();
      const publishedAt = new Date(now - 2 * DAY);
      const mine = `Архивное объявление: ${key}`;
      const foreign = `Архив другого студента: ${key}`;
      await prisma.notification.createMany({
        data: emails.map((email, index) => ({
          dedupeKey: `${fixtureKey}:${index}`,
          audienceType: "STUDENT",
          audienceStudentId: profiles.find((profile) => profile.user.email === email)!.id,
          category: "SCHEDULE",
          source: "DEANERY",
          title: index === 0 ? mine : foreign,
          body: "Срок актуальности истёк, запись остаётся доступной в архиве.",
          publishedAt,
          expiresAt: new Date(now - DAY),
          targetType: "LESSON",
          targetId: `missing-${randomUUID()}`,
        })),
      });
      return { mine, foreign, publishedAt };
    }
    throw new Error("Неизвестная операция браузерной фикстуры.");
  } finally {
    await prisma.$disconnect();
  }
}

void run().then(
  (result) => console.log(JSON.stringify(result)),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Ошибка браузерной фикстуры.");
    process.exitCode = 1;
  },
);
