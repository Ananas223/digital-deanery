import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Создаёт Prisma Client с драйвер-адаптером PostgreSQL.
 *
 * Фабрика вынесена отдельно от singleton-модуля `prisma.ts`, чтобы
 * standalone-скрипты (seed, обслуживание) могли создать собственный клиент
 * вне Next.js-рантайма. Приложение использует только singleton из `prisma.ts`.
 */
export function createPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL не задан. Добавьте строку подключения PostgreSQL в переменные окружения.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}
