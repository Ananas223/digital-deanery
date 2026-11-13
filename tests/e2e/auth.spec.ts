import {
  DEMO_STUDENTS,
  emailField,
  expect,
  expectNoHorizontalScroll,
  passwordField,
  test,
} from "./fixtures";

/**
 * US-01, A-01: первый вход, сессия, меню и выход.
 * Плюс исключения из PRD Ф-01.1 — нейтральная ошибка и очистка пароля.
 */
test.describe("US-01: вход в кабинет", () => {
  test("неавторизованный посетитель попадает на страницу входа", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Вход в кабинет" })).toBeVisible();
  });

  test("вход с верным паролем ведёт на главный экран и сохраняет сессию", async ({ page }) => {
    await page.goto("/login");

    await emailField(page).fill(DEMO_STUDENTS.anna.email);
    await passwordField(page).fill(DEMO_STUDENTS.anna.password);

    const submit = page.getByRole("button", { name: "Войти", exact: true });
    await submit.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Здравствуйте, Анна");

    // Сессия сохраняется при обновлении страницы (Ф-01.2).
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Здравствуйте, Анна");

    // Пять разделов навигации доступны (US-01 п.5): главная + 4 раздела.
    const navigation = page.getByRole("navigation", { name: "Разделы кабинета" }).first();
    for (const label of ["Главная", "Расписание", "Успеваемость", "Заявки", "Уведомления"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }

    await expectNoHorizontalScroll(page);
  });

  test("неверный пароль даёт нейтральную ошибку, логин сохраняется, пароль очищается", async ({
    page,
  }) => {
    await page.goto("/login");

    const email = emailField(page);
    const password = passwordField(page);

    await email.fill(DEMO_STUDENTS.anna.email);
    await password.fill("WrongPassword#1");
    await page.getByRole("button", { name: "Войти", exact: true }).click();

    const alert = page.getByRole("alert").filter({ hasText: "Не удалось войти" });
    await expect(alert).toContainText("Не удалось войти. Проверьте e-mail и пароль.");
    await expect(email).toHaveValue(DEMO_STUDENTS.anna.email);
    await expect(password).toHaveValue("");
  });

  test("клиентская валидация подсвечивает пустые поля без запроса к серверу", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Войти", exact: true }).click();

    await expect(page.getByText("Введите e-mail в формате name@example.ru")).toBeVisible();
    await expect(page.getByText("Пароль не короче 8 символов")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("кнопка показа пароля переключает видимость и подпись", async ({ page }) => {
    await page.goto("/login");

    const password = passwordField(page);
    const toggle = page.getByRole("button", { name: "Показать пароль" });

    await expect(password).toHaveAttribute("type", "password");
    await toggle.click();

    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Скрыть пароль" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("выход через меню завершает сессию и скрывает личные данные", async ({ page }) => {
    await page.goto("/login");

    await emailField(page).fill(DEMO_STUDENTS.mark.email);
    await passwordField(page).fill(DEMO_STUDENTS.mark.password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Здравствуйте, Марк");

    await page.getByRole("button", { name: "Выйти", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Выйти", exact: true }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(DEMO_STUDENTS.mark.name)).toHaveCount(0);

    // После выхода защищённый адрес снова требует входа (A-01).
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login$/);
  });
});
