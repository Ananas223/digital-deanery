import "server-only";

import { createPrismaClient } from "./client";

/**
 * Единственный экземпляр Prisma Client для серверного кода приложения.
 *
 * В dev-режиме сохраняется в `globalThis`, чтобы горячая перезагрузка
 * не создавала новые пулы соединений.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
