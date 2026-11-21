import { emailField, expect, passwordField, test } from "./fixtures";

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

  test("сводка ошибок формы ведёт к соответствующим полям с клавиатуры", async ({ page }) => {
    await page.goto("/login");

    // auth.spec.ts already checks the server's invalid-password alert.
    await page.getByRole("button", { name: "Войти", exact: true }).press("Enter");
    const summary = page.getByRole("alert").filter({ hasText: "Проверьте поля" });
    await expect(summary).toBeVisible();

    await summary
      .getByRole("button", { name: "Пароль не короче 8 символов", exact: true })
      .press("Enter");
    await expect(passwordField(page)).toBeFocused();
    await summary.getByRole("button", { name: /^Введите e-mail в формате/ }).press("Enter");
    await expect(emailField(page)).toBeFocused();
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
