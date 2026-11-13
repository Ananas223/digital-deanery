import "dotenv/config";

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function getTestDatabaseUrl(): string {
  const testDatabaseUrl = process.env["DATABASE_URL_TEST"];

  if (!testDatabaseUrl) {
    throw new Error(
      "DATABASE_URL_TEST не задан. Интеграционные тесты требуют отдельную тестовую базу PostgreSQL.",
    );
  }

  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\//, ""));

  // Защита от случайного запуска миграций и seed против dev- или прод-базы.
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `DATABASE_URL_TEST указывает на базу "${databaseName}", а не на тестовую (*_test). Проверьте .env.`,
    );
  }

  return testDatabaseUrl;
}

function runLocalBin(bin: string, args: string[], env: NodeJS.ProcessEnv): void {
  execFileSync(path.resolve(rootDir, "node_modules/.bin", bin), args, {
    cwd: rootDir,
    env,
    stdio: "inherit",
  });
}

/**
 * Готовит тестовую PostgreSQL перед прогоном Vitest:
 * применяет миграции Prisma и выполняет идемпотентный seed демо-студентов.
 *
 * Работает только с `DATABASE_URL_TEST`; `DATABASE_URL` в дочерних процессах
 * переопределяется на тестовую базу.
 */
export default function setup(): void {
  const testDatabaseUrl = getTestDatabaseUrl();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    BETTER_AUTH_URL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
  };

  runLocalBin("prisma", ["migrate", "deploy"], env);
  runLocalBin("tsx", ["prisma/seed.ts"], env);
}
