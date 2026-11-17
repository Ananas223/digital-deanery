import { DEMO_STUDENTS, expect, expectNoHorizontalScroll, SECTIONS, test } from "./fixtures";

/**
 * Главный экран и навигация (A-12, P0-FE-03/04).
 *
 * Разделы проверяются по заголовкам и доступной навигации; содержимое зависит
 * от готовых серверных модулей, а расписание уже показывает реальные занятия.
 */
test.describe("Главный экран и навигация", () => {
  test("главный экран приветствует студента по имени и показывает разделы", async ({
    annaPage,
  }) => {
    await annaPage.goto("/");

    const main = annaPage.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: "Главная", exact: true }),
    ).toBeVisible();
    await expect(main.getByText("Здравствуйте, Анна!", { exact: true })).toBeVisible();

    const navigation = annaPage.getByRole("navigation", {
      name: "Разделы кабинета",
      exact: true,
    });
    await expect(navigation).toHaveCount(1);
    await expect(navigation).toBeVisible();

    for (const section of SECTIONS) {
      const link = navigation.getByRole("link", { name: section.label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", section.path);
    }

    // Пометка о конкурсном концепте видна в футере (A-10).
    await expect(annaPage.getByText("Учебный концепт для конкурса")).toBeVisible();
    await expectNoHorizontalScroll(annaPage);
  });

  test("все четыре раздела открываются с заголовком и навигацией", async ({ annaPage }) => {
    for (const section of SECTIONS) {
      await annaPage.goto(section.path);

      await expect(annaPage.getByRole("heading", { level: 1, name: section.label })).toBeVisible();
      await expect(
        annaPage.getByRole("navigation", { name: "Разделы кабинета" }).first(),
      ).toBeVisible();
      await expectNoHorizontalScroll(annaPage);
    }
  });

  test("боковое меню отмечает активный раздел", async ({ annaPage }) => {
    await annaPage.goto("/schedule");

    const navigation = annaPage.getByRole("navigation", { name: "Разделы кабинета" }).first();
    await expect(navigation.getByRole("link", { name: "Расписание" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("профиль показывает данные текущего студента и read-only пояснение", async ({
    annaPage,
  }) => {
    await annaPage.goto("/profile");

    await expect(annaPage.getByRole("heading", { level: 1, name: "Профиль" })).toBeVisible();
    await expect(annaPage.getByText(DEMO_STUDENTS.anna.name).first()).toBeVisible();
    await expect(annaPage.getByText(DEMO_STUDENTS.anna.email).first()).toBeVisible();
    await expect(annaPage.getByText(/заполняет деканат/)).toBeVisible();
    await expectNoHorizontalScroll(annaPage);
  });

  test("404 объясняет ситуацию и возвращает на главный экран", async ({ annaPage }) => {
    await annaPage.goto("/this-route-does-not-exist");

    await expect(
      annaPage.getByRole("heading", { name: "Такой страницы в кабинете нет" }),
    ).toBeVisible();
    await annaPage.getByRole("link", { name: "На главный экран" }).click();
    await expect(annaPage).toHaveURL(/\/$/);
  });
});
