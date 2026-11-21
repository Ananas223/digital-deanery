import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { addMoscowWorkingDays } from "../../src/lib/domain/request-time";
import {
  DEMO_STUDENTS,
  emailField,
  expect,
  expectNoHorizontalScroll,
  passwordField,
  test,
} from "./fixtures";

async function openCreatedRequest(page: Page) {
  await expect(page.getByRole("heading", { name: "Заявка отправлена", exact: true })).toBeFocused();
  const number = (await page.getByText(/^№ З-\d{4}-\d{6}$/).textContent())?.replace(/^№ /, "");
  expect(number).toBeTruthy();
  await expect(page.getByText("Новая", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Открыть заявку", exact: true }).click();
  await expect(page).toHaveURL(/\/requests\/[a-z0-9]+$/);
  return { path: new URL(page.url()).pathname, number: number! };
}

async function createCertificate(page: Page, purpose: string) {
  await page.goto("/requests/new?type=STUDY_CERTIFICATE");
  await page.getByLabel("Место предоставления").fill(purpose);
  await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  return openCreatedRequest(page);
}

const TRANSITIONS = {
  IN_PROGRESS: "Новая → В работе",
  READY: "В работе → Готова",
  REJECTED: "В работе → Отклонена",
} as const;

async function changeStatus(
  page: Page,
  path: string,
  status: keyof typeof TRANSITIONS,
  comment: string,
) {
  await test.step(TRANSITIONS[status], async () => {
    if (new URL(page.url()).pathname !== path) await page.goto(path);
    const select = page.getByLabel("Новый статус");
    await expect(select.locator(`option[value="${status}"]`)).toHaveCount(1);
    await select.selectOption(status);
    const message = page.getByRole("textbox", {
      name: status === "REJECTED" ? "Причина отклонения" : "Комментарий",
      exact: true,
    });
    await expect(message).toBeEditable();
    await message.fill(comment);
    const response = page.waitForResponse(
      (item) =>
        new URL(item.url()).pathname === path &&
        item.request().method() === "POST" &&
        Boolean(item.request().headers()["next-action"]),
      { timeout: 10_000 },
    );
    const [result] = await Promise.all([
      response,
      page.getByRole("button", { name: "Изменить статус", exact: true }).click(),
    ]);
    expect(result.ok()).toBe(true);
    const entry = page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ has: page.getByText(TRANSITIONS[status], { exact: true }) });
    await expect(entry.getByText(comment, { exact: true })).toBeVisible();
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test.describe(`US-06–08: заявки, ${viewport.width} px`, () => {
    test.use({ viewport });

    test("ошибка связи сохраняет поля; отправка защищена от дубля, заявка переживает вход и отменяется с подтверждением", async ({
      annaPage,
      markPage,
    }) => {
      test.setTimeout(90_000);
      const purpose = `Библиотека: ${randomUUID()}`;
      const endpoint = "**/requests/new?type=STUDY_CERTIFICATE";
      await annaPage.goto("/requests/new?type=STUDY_CERTIFICATE");
      const duration = await annaPage.getByText(/^Срок подготовки: \d+ рабоч/).textContent();
      const workingDays = Number(duration?.match(/\d+/)?.[0]);
      expect(workingDays).toBeGreaterThan(0);
      const form = annaPage.getByRole("form", { name: "Данные обращения" });
      const delivery = annaPage.getByLabel("Место предоставления");
      const submit = annaPage.getByRole("button", { name: "Отправить заявку", exact: true });
      await submit.click();
      await expect(delivery).toHaveAttribute("aria-invalid", "true");
      await expect(delivery).toBeFocused();
      await expect(form.getByRole("status")).toContainText("Укажите место предоставления справки");
      await delivery.fill(purpose);
      await annaPage
        .getByLabel("Комментарий", { exact: true })
        .fill("Сохранить введённые данные после ошибки связи.");
      await annaPage.route(endpoint, async (route) => {
        if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
          await route.abort("failed");
        } else {
          await route.continue();
        }
      });
      await submit.click();
      await expect(
        annaPage.getByRole("alert").filter({ hasText: "Заявка не подтверждена" }),
      ).toBeVisible();
      await expect(delivery).toHaveValue(purpose);
      await expect(annaPage.getByLabel("Комментарий", { exact: true })).toHaveValue(
        "Сохранить введённые данные после ошибки связи.",
      );
      await annaPage.unroute(endpoint);

      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let posts = 0;
      await annaPage.route(endpoint, async (route) => {
        if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
          posts += 1;
          await gate;
        }
        await route.continue();
      });
      try {
        await submit.click();
        await expect(form).toHaveAttribute("aria-busy", "true");
        await expect(
          form.getByRole("button", { name: "Отправляем заявку", exact: true }),
        ).toBeDisabled();
        await expect(delivery).toBeDisabled();
        await expect.poll(() => posts).toBe(1);
        await form.evaluate((element: HTMLFormElement) => {
          element.requestSubmit();
          element.requestSubmit();
        });
        expect(posts).toBe(1);
      } finally {
        release();
      }
      await expect(
        annaPage.getByRole("heading", { name: "Заявка отправлена", exact: true }),
      ).toBeFocused();
      const creation = annaPage.getByText("Создана", { exact: true }).locator("..").locator("time");
      const deadline = annaPage
        .getByText("Плановая готовность", { exact: true })
        .locator("..")
        .locator("time");
      const createdAt = new Date((await creation.getAttribute("datetime"))!);
      await expect(deadline).toBeVisible();
      await expect(deadline).toHaveAttribute(
        "datetime",
        addMoscowWorkingDays(createdAt, workingDays).toISOString(),
      );
      const created = await openCreatedRequest(annaPage);
      expect(posts).toBe(1);
      await annaPage.unroute(endpoint);
      await expect(annaPage.getByText(purpose, { exact: true })).toBeVisible();
      await expect(annaPage.getByText("Заявка зарегистрирована", { exact: true })).toHaveCount(1);
      await expectNoHorizontalScroll(annaPage);
      await annaPage.reload();
      await expect(annaPage.getByText(purpose, { exact: true })).toBeVisible();

      // A new login does not invalidate the shared fixture's saved session.
      await annaPage.context().clearCookies();
      await annaPage.goto(created.path);
      await expect(annaPage).toHaveURL(/\/login\?/);
      await emailField(annaPage).fill(DEMO_STUDENTS.anna.email);
      await passwordField(annaPage).fill(DEMO_STUDENTS.anna.password);
      const [loginResponse] = await Promise.all([
        annaPage.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
            response.request().method() === "POST",
          { timeout: 10_000 },
        ),
        annaPage.getByRole("button", { name: "Войти", exact: true }).click(),
      ]);
      expect(loginResponse.status(), "Повторный вход для исходной карточки").toBe(200);
      await expect(annaPage).toHaveURL(new RegExp(`${created.path}$`));
      await expect(annaPage.getByText(purpose, { exact: true })).toBeVisible();
      await annaPage.goto("/");
      await expect(annaPage.getByRole("link").filter({ hasText: created.number })).toBeVisible();
      await annaPage.goto("/requests?status=NEW");
      await expect(annaPage.getByRole("link").filter({ hasText: created.number })).toHaveCount(1);
      await markPage.goto("/requests");
      await expect(markPage.getByText(`№ ${created.number}`, { exact: true })).toHaveCount(0);
      await markPage.goto(created.path);
      await expect(
        markPage.getByRole("heading", { name: "Такой страницы в кабинете нет" }),
      ).toBeVisible();
      await expect(markPage.getByText(purpose, { exact: true })).toHaveCount(0);
      await markPage.goto(`/requests/new?repeat=${created.path.split("/").at(-1)}`);
      await expect(
        markPage.getByRole("heading", { name: "Такой страницы в кабинете нет" }),
      ).toBeVisible();

      await annaPage.goto(created.path);
      const cancel = annaPage
        .getByRole("complementary", { name: "Срок и дальнейшие действия" })
        .getByRole("button", { name: "Отменить заявку", exact: true });
      await cancel.click();
      const dialog = annaPage.getByRole("dialog", { name: "Отменить заявку?" });
      await expect(dialog).toBeVisible();
      await annaPage.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(cancel).toBeFocused();
      await cancel.click();
      await dialog.getByRole("button", { name: "Оставить заявку", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(cancel).toBeFocused();
      await expect(annaPage.getByText("Новая", { exact: true }).first()).toBeVisible();
      await cancel.click();
      await expectNoHorizontalScroll(annaPage);
      await dialog.getByRole("button", { name: "Отменить заявку", exact: true }).click();
      await expect(annaPage.getByText("Новая → Отменена", { exact: true })).toBeVisible();
      await expect(cancel).toHaveCount(0);
      await annaPage.reload();
      await expect(annaPage.getByText("Новая → Отменена", { exact: true })).toHaveCount(1);
    });

    test("отклонение сотрудником сохраняет историю; повтор создаёт новый номер с исправленными данными", async ({
      annaPage,
      employeePage,
    }) => {
      const purpose = `Архив: ${randomUUID()}`;
      const created = await createCertificate(annaPage, purpose);
      const processingComment = `Проверка обращения ${randomUUID()}`;
      await changeStatus(employeePage, created.path, "IN_PROGRESS", processingComment);
      await annaPage.reload();
      await expect(annaPage.getByText("Новая → В работе", { exact: true })).toBeVisible();
      await expect(annaPage.getByText(processingComment, { exact: true })).toBeVisible();
      await expect(
        annaPage.getByRole("button", { name: "Отменить заявку", exact: true }),
      ).toHaveCount(0);
      const reason = `Уточните место предоставления: ${randomUUID()}`;
      await employeePage.getByLabel("Новый статус").selectOption("REJECTED");
      await employeePage.getByRole("button", { name: "Изменить статус", exact: true }).click();
      await expect(
        employeePage.getByRole("main").getByRole("alert").filter({
          hasText: "Не удалось изменить статус",
        }),
      ).toContainText("Укажите причину отклонения");
      await changeStatus(employeePage, created.path, "REJECTED", reason);
      await annaPage.reload();
      await expect(
        annaPage.getByRole("alert").filter({ hasText: "Причина отклонения" }),
      ).toContainText(reason);
      await expect(annaPage.getByText("Новая → В работе", { exact: true })).toBeVisible();
      await expect(annaPage.getByText("В работе → Отклонена", { exact: true })).toBeVisible();
      await annaPage.goto("/notifications?category=REQUESTS");
      const rejectionNotification = annaPage
        .getByRole("article")
        .filter({ has: annaPage.locator(`a[href="${created.path}"]`) })
        .filter({ hasText: "Заявка отклонена" });
      await rejectionNotification
        .getByRole("button", { name: "Заявка отклонена", exact: true })
        .click();
      await expect(rejectionNotification).toContainText(created.number);
      await rejectionNotification
        .getByRole("link", { name: "Открыть заявку", exact: true })
        .click();
      await expect(annaPage).toHaveURL(new RegExp(`${created.path}$`));
      await annaPage.getByRole("link", { name: "Создать повторно", exact: true }).click();
      await expect(annaPage.getByLabel("Место предоставления")).toHaveValue(purpose);
      const corrected = `${purpose} — уточнённый адрес`;
      await annaPage.getByLabel("Место предоставления").fill(corrected);
      await expectNoHorizontalScroll(annaPage);
      await annaPage.getByRole("button", { name: "Отправить заявку", exact: true }).click();
      const repeated = await openCreatedRequest(annaPage);
      expect(repeated.path).not.toBe(created.path);
      expect(repeated.number).not.toBe(created.number);
      await expect(annaPage.getByText(corrected, { exact: true })).toBeVisible();
      await annaPage.reload();
      await expect(annaPage.getByText("Заявка зарегистрирована", { exact: true })).toHaveCount(1);
      await annaPage.goto(created.path);
      await expect(annaPage.getByText(purpose, { exact: true })).toBeVisible();
      await expect(annaPage.getByText("В работе → Отклонена", { exact: true })).toBeVisible();
      await expectNoHorizontalScroll(annaPage);
    });

    test("готовность из кабинета сотрудника приходит в уведомления и ведёт в свою карточку с инструкцией", async ({
      markPage,
      employeePage,
      annaPage,
    }) => {
      const purpose = `Практика: ${randomUUID()}`;
      const created = await createCertificate(markPage, purpose);
      await changeStatus(
        employeePage,
        created.path,
        "IN_PROGRESS",
        `Взята в работу ${randomUUID()}`,
      );
      const instruction = `Получите в деканате, кабинет 201. ${randomUUID()}`;
      await changeStatus(employeePage, created.path, "READY", instruction);
      await markPage.goto("/notifications?category=REQUESTS");
      const notification = markPage
        .getByRole("article")
        .filter({ has: markPage.locator(`a[href="${created.path}"]`) })
        .filter({ hasText: "Заявка готова" });
      await notification.getByRole("button", { name: "Заявка готова", exact: true }).click();
      await expect(notification).toContainText(created.number);
      await notification.getByRole("link", { name: "Открыть заявку", exact: true }).click();
      await expect(markPage).toHaveURL(new RegExp(`${created.path}$`));
      await expect(markPage.getByText("В работе → Готова", { exact: true })).toBeVisible();
      await expect(markPage.getByText(instruction, { exact: true })).toBeVisible();
      await expect(
        markPage.getByText(/Для получения документа обратитесь в деканат/),
      ).toBeVisible();
      await expect(
        markPage.getByRole("link", { name: "Создать повторно", exact: true }),
      ).toHaveCount(0);
      await markPage.reload();
      await expect(markPage.getByText("Новая → В работе", { exact: true })).toBeVisible();
      await expectNoHorizontalScroll(markPage);
      await annaPage.goto(created.path);
      await expect(
        annaPage.getByRole("heading", { name: "Такой страницы в кабинете нет" }),
      ).toBeVisible();
    });

    test("четыре типа показывают свои поля, неверные даты блокируются без отправки", async ({
      annaPage,
      markPage,
    }) => {
      await annaPage.goto("/requests/new");
      await expect(annaPage.getByRole("link", { name: /Справка об обучении/ })).toHaveCount(1);
      await annaPage.getByRole("link", { name: /Справка по месту требования/ }).click();
      await expect(annaPage.getByLabel("Организация", { exact: false })).toBeVisible();
      await expect(annaPage.getByLabel("Место предоставления")).toBeVisible();
      await annaPage.getByRole("button", { name: "Отправить заявку", exact: true }).click();
      await expect(annaPage.getByLabel("Организация", { exact: false })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await annaPage.goto("/requests/new?type=ACADEMIC_LEAVE");
      const form = annaPage.getByRole("form", { name: "Данные обращения" });
      await expect(form).toHaveAttribute("method", "post");
      const dateOrderError = "Дата окончания не может быть раньше даты начала";
      const end = form.getByLabel("Дата окончания");
      await expect(end).toHaveAttribute("aria-invalid", "false");
      let posts = 0;
      annaPage.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/requests/new") {
          posts += 1;
        }
      });
      await annaPage
        .getByLabel("Причина академического отпуска")
        .fill("Обстоятельства для проверки формы");
      await form.getByLabel("Дата начала").fill("2026-12-02");
      await end.fill("2026-12-01");
      await form.getByRole("button", { name: "Отправить заявку", exact: true }).press("Enter");
      await expect(end).toHaveAttribute("aria-invalid", "true");
      await expect(end).toBeFocused();
      await expect(end).toHaveAccessibleDescription(dateOrderError);
      const summary = form.getByRole("status");
      await expect(summary.getByText("Проверьте поля заявки", { exact: true })).toBeVisible();
      await expect(summary).toContainText(dateOrderError);
      expect(posts).toBe(0);
      await end.fill("2026-12-03");
      // Chromium can keep Tab within the native date segments; leave the field fully.
      await form.getByRole("textbox", { name: "Комментарий", exact: true }).click();
      await expect(end).toHaveAttribute("aria-invalid", "false");
      await expect(summary.getByText("Проверьте поля заявки", { exact: true })).toHaveCount(0);
      await expectNoHorizontalScroll(annaPage);
      await annaPage.goto("/requests/new?type=RETAKE");
      await expect(annaPage.getByLabel("Дисциплина", { exact: false })).toBeVisible();
      await expect(annaPage.getByLabel("Причина пересдачи")).toBeVisible();
      await expect(annaPage.getByLabel("Место предоставления")).toHaveCount(0);
      await expectNoHorizontalScroll(annaPage);
      // The unchanged seed has no rejected requests for Mark; this suite only rejects Anna's.
      await markPage.goto("/requests?status=REJECTED");
      await expect(
        markPage.getByRole("heading", { name: "В этом статусе заявок нет", exact: true }),
      ).toBeVisible();
      await markPage.getByRole("link", { name: "Все заявки", exact: true }).click();
      await expect(markPage).toHaveURL(/\/requests$/);
      await expect(
        markPage.getByRole("heading", { name: "Мои заявки", exact: true }),
      ).toBeVisible();
      await expectNoHorizontalScroll(markPage);
    });
  });
}
