import type { Locator, Page } from "@playwright/test";

import { expect, expectNoHorizontalScroll, test } from "./fixtures";

const sizes = [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
];

function lessonLinks(page: Page) {
  return page.locator("main [data-lesson-trigger]");
}

async function currentWeek(page: Page) {
  await page.goto("/schedule?view=week");
  await expect(page.getByRole("heading", { name: "Расписание", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Открыть день:/ })).toHaveCount(7);
  await expect(lessonLinks(page).first()).toBeVisible();
}

async function followScheduleLink(page: Page, link: Locator) {
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const destination = new URL(href!, page.url()).href;
  await link.click();
  await expect(page).toHaveURL(destination);
}

async function expectPanelFocus(page: Page, origin: Locator) {
  const before = page.url();
  await origin.focus();
  await origin.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Закрыть подробности" });
  await expect(close).toBeFocused();
  await close.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Успеваемость по дисциплине" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  expect(page.url()).toBe(before);
  await expectNoHorizontalScroll(page);
  return dialog;
}

for (const viewport of sizes) {
  test.describe(`US-02/03: расписание ${viewport.width}px`, () => {
    test.use({ viewport });

    test("день, неделя, периоды и пустые дни сохраняют выбранный контекст", async ({
      annaPage: page,
    }) => {
      await currentWeek(page);
      const days = page.getByRole("navigation", { name: "Дни выбранной недели" });
      const mondayHref = await days.getByRole("link").first().getAttribute("href");
      expect(mondayHref).toBeTruthy();
      const seededWeek = new URL(mondayHref!, page.url()).searchParams.get("week");
      const tuesday = days.getByRole("link").nth(1);
      const selectedDay = new URL(
        (await tuesday.getAttribute("href"))!,
        page.url(),
      ).searchParams.get("day");
      await followScheduleLink(page, tuesday);
      await expect(tuesday).toHaveAttribute("aria-current", "date");
      expect(new URL(page.url()).searchParams.get("day")).toBe(selectedDay);
      const views = page.getByRole("navigation", { name: "Вид расписания" });
      const dayView = views.getByRole("link", { name: "День", exact: true });
      const weekView = views.getByRole("link", { name: "Неделя", exact: true });
      await followScheduleLink(page, dayView);
      await expect(dayView).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("list", { name: "Занятия по времени" })).toBeVisible();
      expect(new URL(page.url()).searchParams.get("day")).toBe(selectedDay);
      await followScheduleLink(page, weekView);
      await expect(weekView).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("link", { name: /^Открыть день:/ })).toHaveCount(7);
      const nextWeek = page.getByRole("link", { name: "Следующая неделя", exact: true });
      const previousWeek = page.getByRole("link", { name: "Предыдущая неделя", exact: true });
      await followScheduleLink(page, nextWeek);
      await expect(
        page.getByRole("heading", { name: "На неделе занятий нет", exact: true }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("week")).not.toBe(seededWeek);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "На неделе занятий нет", exact: true }),
      ).toBeVisible();
      await followScheduleLink(page, previousWeek);
      await expect(lessonLinks(page).first()).toBeVisible();
      expect(new URL(page.url()).searchParams.get("day")).toBe(selectedDay);
      await followScheduleLink(page, previousWeek);
      await expect(
        page.getByRole("heading", { name: "На неделе занятий нет", exact: true }),
      ).toBeVisible();
      await followScheduleLink(
        page,
        page.getByRole("link", { name: "К текущей неделе", exact: true }),
      );
      await expect(lessonLinks(page).first()).toBeVisible();
      expect(new URL(page.url()).searchParams.get("week")).toBe(seededWeek);
      await followScheduleLink(page, page.getByRole("link", { name: /^Открыть день:/ }).last());
      await expect(
        page.getByRole("heading", { name: /^(На этот день|Сегодня) занятий нет$/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^(К сегодняшнему дню|Посмотреть завтра)$/ }),
      ).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test("отмена и перенос видны в списке, подробности удерживают и возвращают фокус", async ({
      annaPage: page,
    }) => {
      await currentWeek(page);
      const cancelled = lessonLinks(page).filter({
        hasText: "Преподаватель на научной конференции",
      });
      await expect(cancelled).toHaveCount(1);
      await expect(cancelled).toContainText("Отменено");
      const selectedUrl = page.url();
      const cancelledPanel = await expectPanelFocus(page, cancelled);
      await expect(cancelledPanel).toContainText("Приходить не нужно.");
      await expect(cancelledPanel).toContainText("Преподаватель на научной конференции");
      await expect(cancelledPanel).toContainText("Первоначально в расписании");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(cancelled).toBeFocused();
      expect(page.url()).toBe(selectedUrl);
      const moved = lessonLinks(page).filter({ hasText: "Перенос после заседания кафедры" });
      await expect(moved).toHaveCount(1);
      await expect(moved).toContainText("12:30");
      await expect(moved).toContainText("10:45");
      const movedPanel = await expectPanelFocus(page, moved);
      await expect(movedPanel).toContainText("Перенос после заседания кафедры");
      await expect(movedPanel).toContainText("Аудитория и корпус");
      await expect(movedPanel).toContainText("Преподаватель");
      await expect(movedPanel).toContainText("Группа и подгруппа");
      await expect(movedPanel).toContainText("Тип занятия");
      const title = await movedPanel.getByRole("heading").first().innerText();
      await movedPanel.getByRole("link", { name: "Успеваемость по дисциплине" }).click();
      await expect(page.locator("#discipline-detail-heading")).toHaveText(title);
      await expect(page.locator("#discipline-detail")).toContainText("Код дисциплины:");
      await expectNoHorizontalScroll(page);
    });

    test("живые времена выделяют текущую и следующую пару, отмена не становится текущей", async ({
      annaPage: page,
    }) => {
      await currentWeek(page);
      await followScheduleLink(page, page.getByRole("link", { name: /^Открыть день:/ }).first());
      await expect(page.getByRole("list", { name: "Занятия по времени" })).toBeVisible();
      const links = lessonLinks(page);
      const cancelled = links.filter({ hasText: "Преподаватель на научной конференции" });
      const active = links.filter({ hasNotText: "Преподаватель на научной конференции" });
      expect(await active.count()).toBeGreaterThanOrEqual(2);
      const first = active.first();
      const firstId = await first.getAttribute("data-lesson-trigger");
      const firstRow = first.locator("xpath=ancestor::li[1]");
      const startsAt = await firstRow.locator("time").first().getAttribute("datetime");
      expect(startsAt).toBeTruthy();
      // Open a real seeded lesson first: modal isolation prevents an automatic day refresh
      // while the client clock moves to this lesson; no server date or data is replaced.
      const dialog = await expectPanelFocus(page, first);
      const effectiveStart = await dialog
        .locator("[data-lesson-details-scroll] time")
        .first()
        .getAttribute("datetime");
      expect(effectiveStart).toBe(startsAt);
      await page.clock.setFixedTime(new Date(new Date(startsAt!).getTime() + 60_000));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await dialog.getByRole("button", { name: "Закрыть подробности" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const current = page.locator(`[data-lesson-trigger="${firstId}"]`);
      await expect(current.getByText("Сейчас", { exact: true })).toBeVisible();
      await expect(current.getByRole("progressbar")).toHaveAttribute("max", "1");
      await expect(current.getByRole("progressbar")).toHaveAttribute("aria-valuetext", /Осталось/);
      await expect(links.getByText("Следующая", { exact: true })).toHaveCount(1);
      await expect(cancelled).toContainText("Отменено");
      await expect(cancelled.getByRole("progressbar")).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    });

    test("прямой адрес занятия возвращает к исходному дню, неверная дата объясняется", async ({
      annaPage: page,
    }) => {
      await currentWeek(page);
      const href = await lessonLinks(page).first().getAttribute("href");
      expect(href).toBeTruthy();
      const expectedContext = new URL(href!, page.url()).search;
      await page.goto(href!);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Аудитория и корпус", { exact: true }).first()).toBeVisible();
      const returnHref = await page
        .locator('main a[href^="/schedule?"]')
        .first()
        .getAttribute("href");
      expect(returnHref).toBeTruthy();
      expect(new URL(returnHref!, page.url()).search).toBe(expectedContext);
      await page.goto(returnHref!);
      await expect(lessonLinks(page).first()).toBeVisible();
      await page.goto("/schedule?view=week&day=invalid-date");
      await expect(page.getByText("Дата в ссылке не распознана", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Открыть день:/ })).toHaveCount(7);
      await expectNoHorizontalScroll(page);
    });
  });
}
