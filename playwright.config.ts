import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const rootDir = process.cwd();

/** Отдельный порт, чтобы E2E не переиспользовал dev-сервер на 3000. */
const E2E_PORT = Number(process.env["E2E_PORT"] ?? 3100);
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

const testDatabaseUrl = process.env["DATABASE_URL_TEST"];

if (!testDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_TEST не задан. E2E-тесты требуют отдельную тестовую базу PostgreSQL (см. README).",
  );
}

// E2E-сервер и фикстуры авторизации работают только с тестовой базой.
process.env["DATABASE_URL"] = testDatabaseUrl;
process.env["BETTER_AUTH_URL"] = E2E_BASE_URL;
process.env["NEXT_PUBLIC_APP_URL"] = E2E_BASE_URL;

/**
 * E2E-конфигурация (P0-BE-07, P0-FE-04).
 *
 * - `webServer` поднимает Next.js на тестовой базе; миграции и seed выполняет
 *   `tests/e2e/global-setup.ts` до старта сервера.
 * - Проект `setup` один раз входит двумя студентами и сохраняет storage state,
 *   чтобы тесты не упирались в лимит попыток входа.
 * - `chromium` использует сохранённую сессию и прогоняет все сценарии.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
      // `responsive.spec.ts` сам задаёт ширины, поэтому не дублируем его в проекте.
      testIgnore: /responsive\.spec\.ts/,
      dependencies: ["setup"],
    },
    {
      name: "responsive",
      testMatch: /responsive\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `next dev --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    cwd: rootDir,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: E2E_BASE_URL,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
    },
  },
});
