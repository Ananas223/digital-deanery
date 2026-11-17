import { DEMO_STUDENTS, emailField, expect, passwordField, test } from "./fixtures";

/**
 * AGENTS.md § 5.4: клавиатура, видимый фокус, подписи полей и текстовые статусы.
 * Полный аудит контраста и скринридера — на этапе 7 (P7-QA-05); здесь —
 * автоматизируемая база для каркаса.
 */
test.describe("Доступность каркаса", () => {
  test("первый Tab фокусирует ссылку «К содержанию», Enter ведёт к main", async ({ page }) => {
    await page.goto("/login");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "К содержанию" });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("поля входа связаны с подписями и подсказками", async ({ page }) => {
    await page.goto("/login");

    const email = emailField(page);
    const password = passwordField(page);

    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "username");
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    await expect(email).toHaveAttribute("aria-describedby", /login-email-hint/);
    await expect(password).toHaveAttribute("aria-required", "true");
  });

  test("ошибка входа объявляется как alert, а не только цветом", async ({ page }) => {
    await page.goto("/login");

    await emailField(page).fill(DEMO_STUDENTS.anna.email);
    await passwordField(page).fill("WrongPassword#1");
    await page.getByRole("button", { name: "Войти", exact: true }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Не удалось войти" })).toBeVisible();
  });

  test("кнопка выхода доступна с клавиатуры и диалог закрывается по Escape", async ({
    annaPage,
  }) => {
    await annaPage.goto("/");

    const logout = annaPage.getByRole("button", { name: "Выйти", exact: true }).first();
    await logout.focus();
    await annaPage.keyboard.press("Enter");

    const dialog = annaPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Выйти из кабинета?" })).toBeVisible();

    await annaPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
