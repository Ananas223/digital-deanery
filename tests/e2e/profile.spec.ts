import { DEMO_STUDENTS, expect, test } from "./fixtures";

/**
 * Ф-01.4–Ф-01.6, A-02: академический профиль приходит из БД и различается
 * между студентами. Чужие поля не попадают на страницу.
 */
test.describe("US-01: академический профиль", () => {
  test("Анна видит свои academic-данные", async ({ annaPage }) => {
    await annaPage.goto("/profile");

    const academicData = annaPage.getByRole("region", {
      name: "Академические данные",
      exact: true,
    });
    await expect(academicData).toBeVisible();
    await expect(annaPage.getByRole("heading", { level: 1, name: "Профиль" })).toBeVisible();
    await expect(academicData.getByText("Факультет международных отношений")).toBeVisible();
    await expect(academicData.getByText("Международные отношения", { exact: true })).toBeVisible();
    await expect(academicData.getByText("MO-21-4", { exact: true })).toBeVisible();
    await expect(academicData.getByText("2 курс", { exact: true })).toBeVisible();
    await expect(academicData.getByText("Бюджетная основа")).toBeVisible();
    await expect(academicData.getByText("MO-21-0047", { exact: true })).toBeVisible();

    // Заглушек и данных другого студента на странице нет.
    await expect(annaPage.getByText("Нет данных")).toHaveCount(0);
    await expect(annaPage.getByText("MEO-11-0112")).toHaveCount(0);
    await expect(annaPage.getByText("MEO-11-2")).toHaveCount(0);
  });

  test("Марк видит свои academic-данные и не видит данные Анны", async ({ markPage }) => {
    await markPage.goto("/profile");

    const academicData = markPage.getByRole("region", {
      name: "Академические данные",
      exact: true,
    });
    await expect(academicData).toBeVisible();
    await expect(
      academicData.getByText("Факультет международных экономических отношений"),
    ).toBeVisible();
    await expect(academicData.getByText("Мировая экономика", { exact: true })).toBeVisible();
    await expect(academicData.getByText("MEO-11-2", { exact: true })).toBeVisible();
    await expect(academicData.getByText("1 курс", { exact: true })).toBeVisible();
    await expect(academicData.getByText("Платная основа")).toBeVisible();
    await expect(academicData.getByText("MEO-11-0112", { exact: true })).toBeVisible();

    await expect(markPage.getByText("MO-21-0047")).toHaveCount(0);
    await expect(markPage.getByText("MO-21-4", { exact: true })).toHaveCount(0);
  });

  test("из профиля можно перейти в раздел заявок", async ({ annaPage }) => {
    await annaPage.goto("/profile");

    await annaPage.getByRole("link", { name: "Перейти в раздел заявок", exact: true }).click();

    await expect(annaPage).toHaveURL(/\/requests$/);
    await expect(annaPage.getByRole("heading", { level: 1, name: "Заявки" })).toBeVisible();
  });

  test("на странице входа есть демонстрационный доступ без паролей в разметке", async ({
    page,
  }) => {
    await page.goto("/login");

    const demoAccess = page.getByRole("region", {
      name: "Демонстрационный доступ",
      exact: true,
    });
    await expect(
      demoAccess.getByRole("heading", {
        level: 2,
        name: "Демонстрационный доступ",
        exact: true,
      }),
    ).toBeVisible();
    const link = demoAccess.getByRole("link", {
      name: "Скачать данные для входа",
      exact: true,
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/demo/README.txt");
    await expect(link).toHaveAttribute("download", "demo-access.txt");

    // Пароль не дублируется в разметке: демо-доступ скачивается отдельным файлом.
    await expect(page.getByText(DEMO_STUDENTS.anna.password)).toHaveCount(0);
  });
});
