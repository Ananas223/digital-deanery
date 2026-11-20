import path from "node:path";

import { test as base, expect } from "@playwright/test";

const rootDir = process.cwd();

/** Демонстрационные аккаунты из `prisma/seed.ts`; пароль совпадает с README. */
export const DEMO_STUDENTS = {
  anna: {
    email: "anna.petrova@example.com",
    name: "Анна Петрова",
    firstName: "Анна",
    password: "Deanery#2026",
  },
  mark: {
    email: "mark.sokolov@example.com",
    name: "Марк Соколов",
    firstName: "Марк",
    password: "Deanery#2026",
  },
} as const;

/** Демо-сотрудник деканата из `prisma/seed.ts`. */
export const DEMO_EMPLOYEE = {
  email: "elena.smirnova@example.com",
  name: "Елена Викторовна Смирнова",
  firstName: "Елена",
  password: "Deanery#2026",
} as const;

/** Куда `auth.setup.ts` сохраняет сессии и откуда их читают сценарии. */
export const STORAGE_STATE = {
  dir: path.join(rootDir, ".auth"),
  anna: path.join(rootDir, ".auth", "anna.json"),
  mark: path.join(rootDir, ".auth", "mark.json"),
  employee: path.join(rootDir, ".auth", "employee.json"),
} as const;

/** Разделы кабинета: подпись в навигации и адрес. */
export const SECTIONS = [
  { label: "Расписание", path: "/schedule" },
  { label: "Успеваемость", path: "/grades" },
  { label: "Заявки", path: "/requests" },
  { label: "Уведомления", path: "/notifications" },
] as const;

/** Ожидаемые заголовки пустых разделов этапа 0 (PRD § 8.6, A-12). */
export const SECTION_HEADINGS: Record<(typeof SECTIONS)[number]["path"], string> = {
  "/schedule": "Расписание",
  "/grades": "Успеваемость",
  "/requests": "Заявки",
  "/notifications": "Уведомления",
};

export const VIEWPORTS = [
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
] as const;

/** Поля входа: подпись обязательного поля содержит `*`, поэтому матчим по роли. */
export function emailField(page: import("@playwright/test").Page) {
  return page.getByRole("textbox", { name: /^E-mail/ });
}

export function passwordField(page: import("@playwright/test").Page) {
  return page.getByRole("textbox", { name: /^Пароль/ });
}

/** Проверяет, что страница не прокручивается по горизонтали (A-08). */
export async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = document.documentElement.clientWidth;
    return { documentWidth, viewportWidth };
  });

  expect(
    overflow.documentWidth,
    `Горизонтальная прокрутка: ${overflow.documentWidth}px при ширине ${overflow.viewportWidth}px`,
  ).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}

type Fixtures = {
  /** Страница с сохранённой сессией Анны. */
  annaPage: import("@playwright/test").Page;
  /** Страница с сохранённой сессией Марка. */
  markPage: import("@playwright/test").Page;
  /** Страница с сохранённой сессией сотрудника деканата. */
  employeePage: import("@playwright/test").Page;
};

/**
 * Расширенный `test`: каждая фикстура создаёт изолированный контекст с storage
 * state демо-студента. Viewport и `baseURL` берутся из текущего теста, иначе
 * `test.use({ viewport })` в responsive-сценариях не применился бы к новой вкладке.
 */
export const test = base.extend<Fixtures>({
  annaPage: async ({ browser, baseURL, viewport }, use) => {
    const context = await browser.newContext({
      baseURL,
      viewport,
      storageState: STORAGE_STATE.anna,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  markPage: async ({ browser, baseURL, viewport }, use) => {
    const context = await browser.newContext({
      baseURL,
      viewport,
      storageState: STORAGE_STATE.mark,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  employeePage: async ({ browser, baseURL, viewport }, use) => {
    const context = await browser.newContext({
      baseURL,
      viewport,
      storageState: STORAGE_STATE.employee,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
