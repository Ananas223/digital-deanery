import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, expectNoHorizontalScroll, test } from "./fixtures";

async function unreadCount(page: Page) {
  const text = await page
    .getByRole("main")
    .getByText(/^Непрочитанных [\d\s]+$/)
    .textContent();
  return Number(text?.replace(/\D/g, ""));
}

async function createEvent(page: Page) {
  await page.goto("/requests/new?type=STUDY_CERTIFICATE");
  await page.getByLabel("Место предоставления").fill(`Уведомления: ${randomUUID()}`);
  await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Заявка отправлена", exact: true })).toBeVisible();
  const number = (await page.getByText(/^№ З-\d{4}-\d{6}$/).textContent())?.replace(/^№ /, "");
  const href = await page
    .getByRole("link", { name: "Открыть заявку", exact: true })
    .getAttribute("href");
  expect(number).toBeTruthy();
  expect(href).toBeTruthy();
  return { number: number!, href: href! };
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test.describe(`US-09: уведомления, ${viewport.width} px`, () => {
    test.use({ viewport });

    test("новое реальное событие приходит по обновлению; ошибка повторяется безопасно, единичное и массовое прочтение сохраняют счётчики", async ({
      markPage,
      annaPage,
    }) => {
      test.setTimeout(90_000);
      await markPage.goto("/notifications?category=REQUESTS");
      const initialCount = await unreadCount(markPage);
      const author = await markPage.context().newPage();
      try {
        const created = await createEvent(author);
        // Existing page is deliberately left mounted while another tab writes an event.
        await expect(markPage.locator(`article:has(a[href="${created.href}"])`)).toHaveCount(0);
        const endpoint = "**/notifications?category=REQUESTS";
        await markPage.route(endpoint, async (route) => {
          if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
            await route.abort("failed");
          } else {
            await route.continue();
          }
        });
        await markPage.getByRole("button", { name: "Обновить ленту", exact: true }).click();
        await expect(
          markPage.getByRole("alert").filter({ hasText: "Действие не завершено" }),
        ).toBeVisible();
        expect(await unreadCount(markPage)).toBe(initialCount);
        await markPage.unroute(endpoint);
        await markPage.getByRole("button", { name: "Повторить", exact: true }).click();
        const card = markPage.locator(`article:has(a[href="${created.href}"])`);
        await expect(card).toHaveCount(1);
        await expect.poll(() => unreadCount(markPage)).toBe(initialCount + 1);
        const navigation = markPage
          .getByRole("navigation", { name: "Разделы кабинета" })
          .filter({ visible: true });
        await expect(navigation.getByRole("link", { name: /Уведомления/ })).toContainText(
          `Непрочитанных ${initialCount + 1}`,
        );
        const expand = card.getByRole("button", { name: "Заявка создана", exact: true });
        await expand.click();
        await expect(expand).toHaveAttribute("aria-expanded", "true");
        await expect(card).toContainText(created.number);
        await expect(card.locator("time")).toHaveAttribute("datetime", /T/);
        await expectNoHorizontalScroll(markPage);
        await card.getByRole("button", { name: /^Отметить прочитанным:/ }).click();
        await expect(card.getByRole("button", { name: /^Прочитано:/ })).toHaveAttribute(
          "aria-disabled",
          "true",
        );
        await expect(expand).toHaveAttribute("aria-expanded", "true");
        await expect.poll(() => unreadCount(markPage)).toBe(initialCount);
        await markPage.reload();
        await expand.click();
        await expect(card.getByRole("button", { name: /^Прочитано:/ })).toHaveAttribute(
          "aria-disabled",
          "true",
        );
        await expect.poll(() => unreadCount(markPage)).toBe(initialCount);
        await annaPage.goto("/notifications?category=REQUESTS");
        await expect(annaPage.locator(`article:has(a[href="${created.href}"])`)).toHaveCount(0);

        const another = await createEvent(author);
        await markPage.getByRole("button", { name: "Обновить ленту", exact: true }).click();
        await expect.poll(() => unreadCount(markPage)).toBe(initialCount + 1);
        await expect(markPage.locator(`article:has(a[href="${another.href}"])`)).toHaveCount(1);
        await markPage
          .getByRole("button", { name: "Отметить всё прочитанным", exact: true })
          .click();
        await expect.poll(() => unreadCount(markPage)).toBe(0);
        await expect(
          markPage.getByRole("button", { name: "Отметить всё прочитанным", exact: true }),
        ).toHaveAttribute("aria-disabled", "true");
        await markPage.reload();
        await expect.poll(() => unreadCount(markPage)).toBe(0);
        await expect(markPage.getByText("Непрочитано", { exact: true })).toHaveCount(0);
        await markPage.goto("/");
        await expect(
          markPage.getByRole("main").getByText("Непрочитанных нет.", { exact: true }),
        ).toBeVisible();
        await expectNoHorizontalScroll(markPage);
      } finally {
        await author.close();
      }
    });

    test("категории, детали дедлайна, дата и связанное занятие доступны с клавиатуры", async ({
      annaPage,
    }) => {
      await annaPage.goto("/notifications");
      const categories = annaPage.getByRole("navigation", { name: "Категории уведомлений" });
      for (const label of ["Все", "Деканат", "Расписание", "Заявки", "Дедлайны"]) {
        await categories.getByRole("link", { name: label, exact: true }).click();
        await expect(categories.getByRole("link", { name: label, exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
        await expectNoHorizontalScroll(annaPage);
      }
      await expect(annaPage).toHaveURL(/category=DEADLINES$/);
      const deadline = annaPage.getByRole("article").filter({
        has: annaPage.getByRole("heading", { name: "Дедлайн курсовой работы", exact: true }),
      });
      const expand = deadline.getByRole("button", { name: "Дедлайн курсовой работы", exact: true });
      await expand.focus();
      await annaPage.keyboard.press("Enter");
      await expect(expand).toHaveAttribute("aria-expanded", "true");
      await expect(deadline).toContainText("Курсовая работа по экономической географии");
      await expect(deadline.locator("time")).toHaveAttribute("datetime", /T/);
      await expectNoHorizontalScroll(annaPage);
      await annaPage.keyboard.press("Space");
      await expect(expand).toHaveAttribute("aria-expanded", "false");
      await categories.getByRole("link", { name: "Расписание", exact: true }).click();
      const lessonCard = annaPage
        .getByRole("article")
        .filter({ has: annaPage.locator('a[href^="/schedule/"]') })
        .first();
      await lessonCard.getByRole("heading").getByRole("button").click();
      const link = lessonCard.getByRole("link", { name: "Открыть занятие", exact: true });
      const destination = await link.getAttribute("href");
      expect(destination).toMatch(/^\/schedule\/[a-z0-9]+$/);
      await link.click();
      await expect(annaPage).toHaveURL(new RegExp(`${destination}$`));
      await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(annaPage);
    });
  });
}
