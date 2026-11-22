import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

/**
 * P7-QA-05, AGENTS.md § 5.4: автоматический аудит WCAG 2.0/2.1 A/AA.
 *
 * Проверяются ядровые экраны обеих ролей. Скринридер в CI не запускается:
 * axe покрывает дерево доступности, подписи, роли, контраст и порядок заголовков;
 * ручная проверка VoiceOver/NVDA остаётся отдельным пунктом приёмки.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const STUDENT_PAGES = [
  { path: "/", name: "главная" },
  { path: "/schedule", name: "расписание" },
  { path: "/grades", name: "успеваемость" },
  { path: "/requests", name: "заявки" },
  { path: "/notifications", name: "уведомления" },
  { path: "/profile", name: "профиль" },
] as const;

test.describe("Доступность: студенческие экраны", () => {
  for (const { path, name } of STUDENT_PAGES) {
    test(`${name} соответствует WCAG 2.1 AA`, async ({ annaPage }) => {
      await annaPage.goto(path);
      await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

      const results = await new AxeBuilder({ page: annaPage }).withTags(WCAG_TAGS).analyze();

      expect(
        results.violations,
        results.violations
          .map((violation) => `${violation.id}: ${violation.nodes.length} — ${violation.help}`)
          .join("\n"),
      ).toEqual([]);
    });
  }

  test("карточка своей заявки соответствует WCAG 2.1 AA", async ({ annaPage }) => {
    await annaPage.goto("/requests");
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    const firstRequest = annaPage
      .locator('a[href^="/requests/"]:not([href="/requests/new"])')
      .first();
    await expect(firstRequest).toBeVisible();
    await firstRequest.click();
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page: annaPage }).withTags(WCAG_TAGS).analyze();

    expect(
      results.violations,
      results.violations
        .map((violation) => `${violation.id}: ${violation.nodes.length} — ${violation.help}`)
        .join("\n"),
    ).toEqual([]);
  });
});

test.describe("Доступность: вход и кабинет сотрудника", () => {
  test("страница входа соответствует WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(
      results.violations,
      results.violations
        .map((violation) => `${violation.id}: ${violation.nodes.length} — ${violation.help}`)
        .join("\n"),
    ).toEqual([]);
  });

  test("очередь сотрудника соответствует WCAG 2.1 AA", async ({ employeePage }) => {
    await employeePage.goto("/requests");
    await expect(employeePage.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page: employeePage }).withTags(WCAG_TAGS).analyze();

    expect(
      results.violations,
      results.violations
        .map((violation) => `${violation.id}: ${violation.nodes.length} — ${violation.help}`)
        .join("\n"),
    ).toEqual([]);
  });
});

test.describe("Доступность: тёмная тема", () => {
  for (const path of ["/", "/requests"] as const) {
    test(`${path} соответствует WCAG 2.1 AA в тёмной теме`, async ({ annaPage }) => {
      await annaPage.goto(path);
      await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

      await annaPage
        .getByRole("combobox", { name: "Тема оформления" })
        .first()
        .selectOption("dark");
      await expect(annaPage.locator("html")).toHaveAttribute("data-theme", "dark");

      const results = await new AxeBuilder({ page: annaPage }).withTags(WCAG_TAGS).analyze();

      expect(
        results.violations,
        results.violations
          .map((violation) => `${violation.id}: ${violation.nodes.length} — ${violation.help}`)
          .join("\n"),
      ).toEqual([]);
    });
  }
});

test.describe("Доступность на 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of ["/", "/requests"] as const) {
    test(`${path} соответствует WCAG 2.1 AA`, async ({ annaPage }) => {
      await annaPage.goto(path);
      await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

      const results = await new AxeBuilder({ page: annaPage }).withTags(WCAG_TAGS).analyze();

      expect(
        results.violations,
        results.violations
          .map((violation) => `${violation.id}: ${violation.nodes.length} — ${violation.help}`)
          .join("\n"),
      ).toEqual([]);
    });
  }
});
