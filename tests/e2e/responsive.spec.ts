import {
  DEMO_STUDENTS,
  expect,
  expectNoHorizontalScroll,
  SECTIONS,
  test,
  VIEWPORTS,
} from "./fixtures";

/**
 * A-08, P0-FE-04: проверка на 360, 390, 768 и 1280 px.
 *
 * На мобильном работает нижняя навигация, на широком — боковое меню;
 * две панели не показываются одновременно (AGENTS.md § 5.1).
 */
for (const viewport of VIEWPORTS) {
  test.describe(`Ширина ${viewport.name}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    const isMobile = viewport.width < 768;

    test("страница входа не создаёт горизонтальную прокрутку", async ({ page }) => {
      await page.goto("/login");

      await expect(
        page.getByRole("heading", { level: 1, name: "Деканат будущего", exact: true }),
      ).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test("главный экран и все разделы помещаются по ширине", async ({ annaPage }) => {
      for (const path of ["/", ...SECTIONS.map((section) => section.path)]) {
        await annaPage.goto(path);
        await expect(annaPage.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoHorizontalScroll(annaPage);
      }
    });

    test(`показана ${isMobile ? "нижняя" : "боковая"} навигация`, async ({ annaPage }) => {
      await annaPage.goto("/schedule");

      const navigation = annaPage.getByRole("navigation", { name: "Разделы кабинета" }).first();
      await expect(navigation).toBeVisible();

      // Нижняя панель закреплена у нижней границы окна, боковое меню — в потоке.
      const box = await navigation.boundingBox();
      expect(box).not.toBeNull();

      if (isMobile) {
        expect(box!.y + box!.height).toBeGreaterThanOrEqual(viewport.height - 120);
        // Все пять пунктов доступны без прокрутки.
        for (const label of ["Главная", "Расписание", "Успеваемость", "Заявки", "Уведомления"]) {
          await expect(navigation.getByRole("link", { name: label })).toBeVisible();
        }
      } else {
        expect(box!.width).toBeLessThan(viewport.width / 2);
      }
    });

    test("профиль не обрезает длинные значения", async ({ annaPage }) => {
      await annaPage.goto("/profile");

      await expect(annaPage.getByText(DEMO_STUDENTS.anna.email).first()).toBeVisible();
      await expectNoHorizontalScroll(annaPage);
    });
  });
}
