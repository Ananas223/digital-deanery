import { DEMO_STUDENTS, expect, test } from "./fixtures";

/**
 * P7-QA-05, AGENTS.md § 5.4: проход клавиатурой, видимый фокус, ловушка фокуса
 * в диалогах, возврат фокуса и доступные имена/ориентиры для скринридера.
 *
 * Реальный VoiceOver/NVDA в CI не запускается. Здесь проверяется контракт,
 * который скринридер читает: landmarks, единственный h1, подписи навигации,
 * текстовые статусы и доступные имена элементов.
 */

async function focusedElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;

    return {
      tag: element.tagName.toLowerCase(),
      text: (element.textContent ?? "").trim().slice(0, 80),
      href: element.getAttribute("href"),
      label: element.getAttribute("aria-label"),
      insideDialog: Boolean(
        element.closest('[role="dialog"]') || element.hasAttribute("data-base-ui-focus-guard"),
      ),
    };
  });
}

async function expectVisibleFocus(page: import("@playwright/test").Page) {
  const visible = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return false;

    const style = getComputedStyle(element);
    const outline =
      style.outlineStyle !== "none" &&
      Number.parseFloat(style.outlineWidth) >= 2 &&
      style.outlineColor !== "transparent";
    const shadow = style.boxShadow !== "none" && style.boxShadow !== "";

    return outline || shadow;
  });

  expect(visible, "у сфокусированного элемента нет видимой обводки или тени").toBe(true);
}

async function tabTo(
  page: import("@playwright/test").Page,
  predicate: (focused: NonNullable<Awaited<ReturnType<typeof focusedElement>>>) => boolean,
  maxTabs = 40,
) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    const focused = await focusedElement(page);
    if (focused && predicate(focused)) {
      return focused;
    }
  }

  throw new Error(`Фокус не дошёл до нужного элемента за ${maxTabs} нажатий Tab`);
}

test.describe("Клавиатура и видимый фокус", () => {
  test("вход выполняется только с клавиатуры, у полей виден фокус", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const email = await tabTo(page, (focused) => focused.tag === "input" && focused.label === null);
    await expectVisibleFocus(page);
    expect(email.tag).toBe("input");

    await page.keyboard.type(DEMO_STUDENTS.anna.email);
    await page.keyboard.press("Tab");
    await expectVisibleFocus(page);
    await page.keyboard.type(DEMO_STUDENTS.anna.password);
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("боковая навигация доступна с клавиатуры и ведёт по Enter", async ({ annaPage }) => {
    await annaPage.goto("/");
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    await tabTo(annaPage, (focused) => focused.href === "/schedule");
    await expectVisibleFocus(annaPage);
    await annaPage.keyboard.press("Enter");

    await expect(annaPage).toHaveURL(/\/schedule$/);
    await expect(annaPage.getByRole("heading", { level: 1, name: "Расписание" })).toBeVisible();
  });

  test("нижняя навигация на 360 px доступна с клавиатуры", async ({ annaPage }) => {
    await annaPage.setViewportSize({ width: 360, height: 740 });
    await annaPage.goto("/");
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    const navigation = annaPage.getByRole("navigation", { name: "Разделы кабинета" }).first();
    await expect(navigation).toBeVisible();

    await tabTo(annaPage, (focused) => focused.href === "/grades");
    await expectVisibleFocus(annaPage);
    await annaPage.keyboard.press("Enter");

    await expect(annaPage).toHaveURL(/\/grades$/);
  });

  test("диалог выхода удерживает фокус и закрывается по Escape", async ({ annaPage }) => {
    await annaPage.goto("/");
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    const trigger = annaPage.getByRole("button", { name: "Выйти", exact: true }).first();
    await trigger.focus();
    await annaPage.keyboard.press("Enter");

    const dialog = annaPage.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (let index = 0; index < 8; index += 1) {
      await annaPage.keyboard.press("Tab");
      const focused = await focusedElement(annaPage);
      expect(focused?.insideDialog, `фокус вышел из диалога на шаге ${index + 1}`).toBe(true);
    }

    await annaPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("подтверждение отмены заявки доступно с клавиатуры и закрывается по Escape", async ({
    annaPage,
  }) => {
    await annaPage.goto("/requests");
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    await annaPage.locator('a[href^="/requests/"]:not([href^="/requests/new"])').first().click();
    const trigger = annaPage.getByRole("button", { name: "Отменить заявку" }).first();
    await expect(trigger).toBeVisible();

    await trigger.focus();
    await annaPage.keyboard.press("Enter");

    const dialog = annaPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Отменить заявку?" })).toBeVisible();

    for (let index = 0; index < 8; index += 1) {
      await annaPage.keyboard.press("Tab");
      const focused = await focusedElement(annaPage);
      expect(
        focused?.insideDialog,
        `фокус вышел из диалога на шаге ${index + 1}: ${focused?.text ?? ""}`,
      ).toBe(true);
    }

    await annaPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("панель Блика открывается и закрывается с клавиатуры", async ({ annaPage }) => {
    await annaPage.goto("/");
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    const trigger = annaPage.getByRole("button", { name: /^Блик/ }).first();
    await trigger.focus();
    await annaPage.keyboard.press("Enter");

    const panel = annaPage.getByRole("dialog", { name: "Блик" });
    await expect(panel).toBeVisible();

    await annaPage.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("Контракт для скринридера", () => {
  const pages = [
    { path: "/", heading: /./ },
    { path: "/schedule", heading: "Расписание" },
    { path: "/grades", heading: "Успеваемость" },
    { path: "/requests", heading: "Заявки" },
    { path: "/notifications", heading: "Уведомления" },
    { path: "/profile", heading: "Профиль" },
  ] as const;

  for (const { path, heading } of pages) {
    test(`${path}: ориентиры, один h1 и подпись навигации`, async ({ annaPage }) => {
      await annaPage.goto(path);
      await expect(annaPage.getByRole("heading", { level: 1, name: heading })).toBeVisible();

      await expect(annaPage.locator("main")).toHaveCount(1);
      await expect(annaPage.locator("h1")).toHaveCount(1);
      await expect(annaPage.locator("html")).toHaveAttribute("lang", "ru");
      await expect(
        annaPage.getByRole("navigation", { name: "Разделы кабинета" }).first(),
      ).toBeVisible();
    });
  }

  test("статусы заявок переданы текстом, а не только цветом", async ({ annaPage }) => {
    await annaPage.goto("/requests");
    await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();

    const statusTexts = await annaPage
      .locator('a[href^="/requests/"]:not([href^="/requests/new"])')
      .allTextContents();
    expect(statusTexts.length).toBeGreaterThan(0);
    for (const text of statusTexts) {
      expect(text).toMatch(/Новая|В работе|Готова|Отклонена|Отменена/);
    }
  });
});
