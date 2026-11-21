import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import type { Page, TestInfo } from "@playwright/test";

import { formatDate, formatWorkingDays } from "../../src/lib/format";
import { DEMO_STUDENTS, expect, expectNoHorizontalScroll, test } from "./fixtures";

/** Prisma генерирует ESM-клиент; для фикстур используем тот же tsx, что и для seed. */
function fixture<T = unknown>(...args: string[]): T {
  const requireFromProject = createRequire(resolve("package.json"));
  const result = execFileSync(
    process.execPath,
    [requireFromProject.resolve("tsx/cli"), "tests/e2e/blocker-data.ts", ...args],
    { encoding: "utf8", timeout: 12_000, windowsHide: true },
  );
  return JSON.parse(result) as T;
}

async function capture(page: Page, info: TestInfo, name: string) {
  if (process.env["DEANERY_CAPTURE_BLOCKERS"] !== "1") return;
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test.describe(`Блокеры v4: ${viewport.width} px`, () => {
    test.use({ viewport });

    test("первая учебная неделя получает номер 1, включая августовский понедельник", async ({
      annaPage,
    }, info) => {
      for (const day of ["2026-08-31", "2026-09-01", "2026-09-06"]) {
        await annaPage.goto(`/schedule?view=week&day=${day}&week=2026-08-31`);
        const plan = annaPage.getByRole("complementary", { name: "План недели" });
        await expect(plan.getByText("№ 1", { exact: true })).toBeVisible();
        await expect(annaPage.getByRole("link", { name: /^Открыть день:/ })).toHaveCount(7);
        await expectNoHorizontalScroll(annaPage);
      }
      await capture(annaPage, info, "study-week-1");
    });

    test("каталог и форма показывают нормативные сроки активных типов из базы до подачи", async ({
      annaPage,
    }, info) => {
      const types = fixture<
        {
          code: string;
          title: string;
          description: string;
          processingDays: number;
        }[]
      >("catalog");
      expect(types).toHaveLength(4);
      await annaPage.goto("/requests/new");
      const catalog = annaPage.getByRole("region", { name: "С чего начнём?" });
      await expect(catalog.getByRole("link")).toHaveCount(types.length);
      for (const type of types) {
        const card = catalog.locator(`a[href="/requests/new?type=${type.code}"]`);
        await expect(card).toContainText(type.description);
        await expect(card).toContainText(
          `Срок подготовки: ${formatWorkingDays(type.processingDays)}`,
        );
        await expect(card).toContainText("Понадобится");
      }
      await capture(annaPage, info, "request-catalog");
      const certificate = types.find((type) => type.code === "STUDY_CERTIFICATE")!;
      await catalog.locator(`a[href="/requests/new?type=${certificate.code}"]`).click();
      await expect(annaPage.getByRole("heading", { level: 1 })).toHaveText(certificate.title);
      await expect(
        annaPage.getByText(`Срок подготовки: ${formatWorkingDays(certificate.processingDays)}`),
      ).toBeVisible();
      await expect(annaPage.getByRole("form", { name: "Данные обращения" })).toBeVisible();
      await expectNoHorizontalScroll(annaPage);
    });

    test("перенос отмечен в списке, а неопубликованная сессия показывает ориентир группы", async ({
      annaPage,
    }, info) => {
      await annaPage.goto("/grades?tab=session");
      const moved = annaPage.getByRole("listitem").filter({ hasText: "Перенесено" });
      await expect(moved).toHaveCount(1);
      await expect(moved).toContainText("Было:");
      await expect(moved).toContainText("Стало:");
      const moveTimes = moved.getByText(/^Было:/).locator("time");
      await expect(moveTimes).toHaveCount(2);
      const times = await moveTimes.evaluateAll((elements) =>
        elements.map((element) => new Date(element.getAttribute("datetime")!).getTime()),
      );
      expect(times[1]! - times[0]!).toBe(2 * 86_400_000);
      await expectNoHorizontalScroll(annaPage);
      await moved.scrollIntoViewIfNeeded();
      await capture(annaPage, info, "exam-rescheduled");

      const key = randomUUID();
      try {
        const { id, expectedAt } = fixture<{ id: string; expectedAt: string }>(
          "pending-session",
          key,
          DEMO_STUDENTS.anna.email,
        );
        await annaPage.goto(`/grades?semesterId=${id}&tab=session`);
        await expect(
          annaPage.getByRole("heading", { name: "Расписание сессии ещё не опубликовано" }),
        ).toBeVisible();
        await expect(
          annaPage.getByText(`Ориентир публикации — ${formatDate(new Date(expectedAt))}`, {
            exact: false,
          }),
        ).toBeVisible();
        await expect(annaPage.getByRole("region", { name: "Предстоящие и текущие" })).toHaveCount(
          0,
        );
        await expectNoHorizontalScroll(annaPage);
        await capture(annaPage, info, "session-not-published");
      } finally {
        fixture("clean-session", key);
      }
    });

    test("архив сохраняет источник и дату, не выдаёт чужие события и не меняет счётчик", async ({
      annaPage,
    }, info) => {
      const key = randomUUID();
      try {
        const { mine, foreign, publishedAt } = fixture<{
          mine: string;
          foreign: string;
          publishedAt: string;
        }>("archived-notices", key, DEMO_STUDENTS.anna.email, DEMO_STUDENTS.mark.email);

        await annaPage.goto("/notifications");
        const main = annaPage.getByRole("main");
        const counter = main.getByText(/^Непрочитанных [\d\s]+$/);
        await expect(counter).toBeVisible();
        const initialCount = await counter.innerText();
        await expect(main.getByText(mine, { exact: true })).toHaveCount(0);
        const scopes = main.getByRole("navigation", { name: "Лента и архив" });
        await scopes.getByRole("link", { name: "Архив", exact: true }).click();
        await expect(annaPage).toHaveURL(/scope=ARCHIVE$/);
        await expect(scopes.getByRole("link", { name: "Архив", exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
        const categories = main.getByRole("navigation", { name: "Категории уведомлений" });
        await categories.getByRole("link", { name: "Деканат", exact: true }).click();
        await expect(annaPage).toHaveURL(/scope=ARCHIVE&category=DEANERY$/);
        await expect(main.getByText(mine, { exact: true })).toHaveCount(0);
        await categories.getByRole("link", { name: "Расписание", exact: true }).click();
        await expect(annaPage).toHaveURL(/scope=ARCHIVE&category=SCHEDULE$/);
        const card = main.getByRole("article", { name: mine, exact: true });
        await expect(card).toContainText("Источник: Деканат");
        await expect(card.locator("time")).toHaveAttribute("datetime", publishedAt);
        await expect(main.getByText(foreign, { exact: true })).toHaveCount(0);
        await card.getByRole("button", { name: mine, exact: true }).click();
        await expect(card.getByRole("button", { name: /прочитанным/i })).toHaveCount(0);
        await expectNoHorizontalScroll(annaPage);
        await capture(annaPage, info, "notification-archive");
        await card.getByRole("link", { name: "Открыть занятие", exact: true }).click();
        await expect(
          annaPage.getByRole("heading", { name: "Занятие не найдено", level: 1 }),
        ).toBeVisible();
        await expect(annaPage.getByRole("link", { name: "К расписанию" })).toHaveAttribute(
          "href",
          "/schedule",
        );
        await annaPage.goto("/notifications");
        await expect(counter).toHaveText(initialCount);
      } finally {
        fixture("clean-notices", key);
      }
    });
  });
}
