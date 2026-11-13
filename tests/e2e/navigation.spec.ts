import { DEMO_STUDENTS, expect, expectNoHorizontalScroll, SECTIONS, test } from "./fixtures";

/**
 * Каркас разделов и навигация (A-12, P0-FE-03/04).
 *
 * На этапе 0 разделы — объяснённые пустые состояния без «рыбного» текста;
 * сценарии US-02…US-09 расширяются на этапах 2–5, когда появляются данные.
 */
test.describe("Главный экран и навигация", () => {
  test("главный экран приветствует студента по имени и показывает разделы", async ({
    annaPage,
  }) => {
    await annaPage.goto("/");

    await expect(annaPage.getByRole("heading", { level: 1 })).toContainText("Здравствуйте, Анна");
    await expect(annaPage.getByRole("heading", { name: "Разделы кабинета" })).toBeVisible();

    for (const section of SECTIONS) {
      await expect(
        annaPage.getByRole("link", { name: new RegExp(section.label) }).first(),
      ).toBeVisible();
    }

    // Пометка о конкурсном концепте видна в футере (A-10).
    await expect(annaPage.getByText("Учебный концепт для конкурса")).toBeVisible();
    await expectNoHorizontalScroll(annaPage);
  });

  test("все четыре раздела открываются и объясняют пустое состояние", async ({ annaPage }) => {
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
