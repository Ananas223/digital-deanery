import { DEMO_STUDENTS, expect, test } from "./fixtures";

/**
 * Ф-01.4–Ф-01.6, A-02: академический профиль приходит из БД и различается
 * между студентами. Чужие поля не попадают на страницу.
 */
test.describe("US-01: академический профиль", () => {
  test("Анна видит свои academic-данные", async ({ annaPage }) => {
    await annaPage.goto("/profile");

    await expect(annaPage.getByRole("heading", { level: 1, name: "Профиль" })).toBeVisible();
    await expect(annaPage.getByText("Факультет международных отношений")).toBeVisible();
    await expect(annaPage.getByText("Международные отношения", { exact: true })).toBeVisible();
    await expect(annaPage.getByText("MO-21-4", { exact: true })).toBeVisible();
    await expect(annaPage.getByText("2 курса", { exact: true })).toBeVisible();
    await expect(annaPage.getByText("Бюджетная основа")).toBeVisible();
    await expect(annaPage.getByText("MO-21-0047", { exact: true })).toBeVisible();

    // Заглушек и данных другого студента на странице нет.
    await expect(annaPage.getByText("Нет данных")).toHaveCount(0);
    await expect(annaPage.getByText("MEO-11-0112")).toHaveCount(0);
    await expect(annaPage.getByText("MEO-11-2")).toHaveCount(0);
  });

  test("Марк видит свои academic-данные и не видит данные Анны", async ({ markPage }) => {
    await markPage.goto("/profile");

    await expect(
      markPage.getByText("Факультет международных экономических отношений"),
    ).toBeVisible();
    await expect(markPage.getByText("Мировая экономика", { exact: true })).toBeVisible();
    await expect(markPage.getByText("MEO-11-2", { exact: true })).toBeVisible();
    await expect(markPage.getByText("1 курс", { exact: true })).toBeVisible();
    await expect(markPage.getByText("Платная основа")).toBeVisible();
    await expect(markPage.getByText("MEO-11-0112", { exact: true })).toBeVisible();

    await expect(markPage.getByText("MO-21-0047")).toHaveCount(0);
    await expect(markPage.getByText("MO-21-4", { exact: true })).toHaveCount(0);
  });

  test("из профиля можно перейти к созданию заявки", async ({ annaPage }) => {
    await annaPage.goto("/profile");

    await annaPage.getByRole("link", { name: "Создать заявку" }).click();

    await expect(annaPage).toHaveURL(/\/requests$/);
    await expect(annaPage.getByRole("heading", { level: 1, name: "Заявки" })).toBeVisible();
  });

  test("на странице входа есть демонстрационный доступ без паролей в коде", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("Демонстрационный доступ")).toBeVisible();
    const link = page.getByRole("link", { name: /README, раздел «Демо-аккаунты»/ });
    await expect(link).toHaveAttribute("href", /README\.md#демо-аккаунты$/);

    // Пароль не дублируется в разметке: он описан только в README (AGENTS.md § 4.2).
    await expect(page.getByText(DEMO_STUDENTS.anna.password)).toHaveCount(0);
  });
});
