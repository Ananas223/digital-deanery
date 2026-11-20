import { expect, test } from "./fixtures";

/**
 * US-11: сотрудник деканата видит очередь, открывает карточку, меняет статус
 * и оставляет комментарий; студент не получает доступ к очереди.
 */
test.describe("US-11: кабинет сотрудника деканата", () => {
  test("сотрудник берёт заявку в работу и оставляет комментарий", async ({ employeePage }) => {
    await employeePage.goto("/requests");

    await expect(
      employeePage.getByRole("heading", { level: 1, name: "Очередь заявок" }),
    ).toBeVisible();

    const requestLink = employeePage
      .getByRole("link", { name: /Справка по месту требования/ })
      .first();
    await expect(requestLink).toBeVisible();
    await requestLink.click();

    await expect(employeePage.getByRole("heading", { level: 1 })).toContainText(
      "Справка по месту требования",
    );

    await employeePage.getByLabel("Новый статус").selectOption("IN_PROGRESS");
    await employeePage
      .getByLabel("Комментарий")
      .fill("Проверяю данные организации и подготовлю справку.");
    await employeePage.getByRole("button", { name: "Изменить статус" }).click();

    await expect(employeePage.getByText("Новая → В работе")).toBeVisible();
    await expect(
      employeePage.getByText("Проверяю данные организации и подготовлю справку."),
    ).toBeVisible();

    await employeePage.reload();
    await expect(employeePage.getByText("Новая → В работе")).toBeVisible();
    await expect(employeePage.getByText("В работе", { exact: true }).first()).toBeVisible();
  });

  test("студент не видит очередь сотрудника", async ({ annaPage }) => {
    await annaPage.goto("/requests");

    await expect(annaPage.getByRole("heading", { level: 1, name: "Заявки" })).toBeVisible();
    await expect(annaPage.getByText("Очередь заявок")).toHaveCount(0);
    await expect(annaPage.getByText("Заявок пока нет")).toBeVisible();
  });
});

test.describe("кабинет сотрудника на мобильном", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("очередь и карточка не прокручиваются по горизонтали", async ({ employeePage }) => {
    await employeePage.goto("/requests");
    await expect(
      employeePage.getByRole("heading", { level: 1, name: "Очередь заявок" }),
    ).toBeVisible();

    const scrollWidth = await employeePage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await employeePage.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await employeePage
      .getByRole("link", { name: /Справка/ })
      .first()
      .click();
    await expect(employeePage.getByRole("heading", { level: 1 })).toBeVisible();

    const cardScrollWidth = await employeePage.evaluate(() => document.documentElement.scrollWidth);
    const cardClientWidth = await employeePage.evaluate(() => document.documentElement.clientWidth);
    expect(cardScrollWidth).toBeLessThanOrEqual(cardClientWidth + 1);
  });
});
