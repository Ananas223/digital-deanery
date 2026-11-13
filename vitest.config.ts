import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const testDatabaseUrl = process.env["DATABASE_URL_TEST"];

if (!testDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_TEST не задан. Интеграционные тесты требуют отдельную тестовую базу PostgreSQL.",
  );
}

// Тесты и globalSetup работают только с тестовой базой; dev-база не затрагивается.
process.env["DATABASE_URL"] = testDatabaseUrl;
process.env["BETTER_AUTH_URL"] ??= process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
process.env["NEXT_PUBLIC_APP_URL"] ??= process.env["BETTER_AUTH_URL"];

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      // `server-only` — маркер Next.js: в Node-тестах он не должен бросать ошибку.
      "server-only": path.resolve(rootDir, "tests/setup/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/setup/global-setup.ts"],
    // Интеграционные тесты используют одну тестовую БД: файлы идут последовательно.
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
