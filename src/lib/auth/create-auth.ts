import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import type { PrismaClient } from "@/generated/prisma/client";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

function getTrustedOrigins(): string[] {
  const appUrl = process.env["BETTER_AUTH_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"];
  return appUrl ? [appUrl] : [];
}

/**
 * Собирает конфигурацию Better Auth для переданного Prisma Client.
 *
 * Фабрика используется приложением (`auth.ts`) и seed-скриптом, чтобы пароли
 * хешировались одним и тем же способом Better Auth (scrypt).
 */
export function createAuth(
  prisma: PrismaClient,
  options: { allowSignUp?: boolean } = {},
) {
  return betterAuth({
    appName: "Цифровой деканат будущего",
    baseURL: process.env["BETTER_AUTH_URL"],
    secret: process.env["BETTER_AUTH_SECRET"],
    trustedOrigins: getTrustedOrigins(),
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
      // Публичная регистрация закрыта: аккаунты создаёт только seed.
      // Отдельный экземпляр для seed включается флагом allowSignUp.
      disableSignUp: !options.allowSignUp,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    user: {
      additionalFields: {
        // Роль назначается только на сервере; input: false запрещает клиенту
        // передавать её при регистрации или обновлении пользователя.
        role: {
          type: "string",
          required: false,
          defaultValue: "STUDENT",
          input: false,
        },
      },
    },
    // nextCookies должен оставаться последним плагином.
    plugins: [nextCookies()],
  });
}
