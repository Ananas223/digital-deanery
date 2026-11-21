import "dotenv/config";

import { runLocalBin } from "../setup/run-local-bin";

const rootDir = process.cwd();

/**
 * Готовит тестовую PostgreSQL перед E2E-прогоном: применяет миграции Prisma
 * и выполняет идемпотентный seed демо-студентов.
 *
 * Защита от случайного запуска против dev- или прод-базы: имя базы должно
 * заканчиваться на `_test`.
 */
function getTestDatabaseUrl(): string {
  const testDatabaseUrl = process.env["DATABASE_URL_TEST"];

  if (!testDatabaseUrl) {
    throw new Error(
      "DATABASE_URL_TEST не задан. E2E-тесты требуют отдельную тестовую базу PostgreSQL.",
    );
  }

  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\//, ""));

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `DATABASE_URL_TEST указывает на базу "${databaseName}", а не на тестовую (*_test). Проверьте .env.`,
    );
  }

  return testDatabaseUrl;
}

export default function globalSetup(): void {
  const testDatabaseUrl = getTestDatabaseUrl();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    BETTER_AUTH_URL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3100",
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3100",
  };

  runLocalBin(rootDir, "prisma", ["migrate", "deploy"], env);
  runLocalBin(rootDir, "tsx", ["prisma/seed.ts"], env);
}
