import "server-only";

import { createAuth } from "@/lib/auth/create-auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Серверный экземпляр Better Auth. Импортировать разрешено только из
 * server-only модулей (Route Handlers, Server Actions, серверные помощники).
 */
export const auth = createAuth(prisma);
