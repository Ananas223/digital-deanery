import { DEMO_STUDENTS, expect, test } from "./fixtures";

/**
 * US-10, AGENTS.md § 3.2: разделение данных между аккаунтами.
 *
 * Проверяем профиль, сессии, гостевой доступ, чужую заявку и вложенные адреса:
 * - сессия одного студента не отдаёт данные другого;
 * - гость не читает защищённые разделы;
 * - чужая заявка и несуществующий вложенный адрес отдают нейтральный 404;
 * - серверная сессия, а не хранилище браузера, определяет пользователя.
 */
test.describe("US-10: разделение данных", () => {
  test("Анна видит только свой профиль", async ({ annaPage }) => {
    await annaPage.goto("/profile");

    await expect(annaPage.getByText(DEMO_STUDENTS.anna.name).first()).toBeVisible();
    await expect(annaPage.getByText(DEMO_STUDENTS.mark.name)).toHaveCount(0);
    await expect(annaPage.getByText(DEMO_STUDENTS.mark.email)).toHaveCount(0);
  });

  test("Марк видит только свой профиль и не видит данные Анны", async ({ markPage }) => {
    await markPage.goto("/profile");

    await expect(markPage.getByText(DEMO_STUDENTS.mark.name).first()).toBeVisible();
    await expect(markPage.getByText(DEMO_STUDENTS.anna.name)).toHaveCount(0);
    await expect(markPage.getByText(DEMO_STUDENTS.anna.email)).toHaveCount(0);
  });

  test("cookie сессии разных студентов не пересекаются", async ({ annaPage, markPage }) => {
    const annaSession = await annaPage.request.get("/api/auth/get-session");
    const markSession = await markPage.request.get("/api/auth/get-session");

    expect(annaSession.status()).toBe(200);
    expect(markSession.status()).toBe(200);

    const annaBody = (await annaSession.json()) as { user?: { email?: string } };
    const markBody = (await markSession.json()) as { user?: { email?: string } };

    expect(annaBody.user?.email).toBe(DEMO_STUDENTS.anna.email);
    expect(markBody.user?.email).toBe(DEMO_STUDENTS.mark.email);
    expect(annaBody.user?.email).not.toBe(markBody.user?.email);
  });

  test("гость не получает сессию и защищённые адреса отдают редирект", async ({ page }) => {
    const response = await page.request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);
    expect(await response.json()).toBeNull();

    for (const path of ["/", "/profile", "/schedule", "/grades", "/requests", "/notifications"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(\?|$)/);
    }
  });

  test("чужая заявка по прямому адресу не раскрывается", async ({ annaPage, markPage }) => {
    await markPage.goto("/requests");
    // На странице есть ссылка «Новая заявка» (`/requests/new`); нужна карточка с идентификатором.
    const foreignHref = await markPage
      .locator('a[href^="/requests/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href"))
          .find(
            (href) => href !== null && /^\/requests\/[^/]+$/.test(href) && href !== "/requests/new",
          ),
      );
    expect(foreignHref).toBeTruthy();

    const response = await annaPage.goto(foreignHref!);

    expect(response?.status()).toBe(404);
    await expect(annaPage.getByText("Такой страницы в кабинете нет")).toBeVisible();
    await expect(annaPage.getByText(/З-2026-90000[456]/)).toHaveCount(0);
    await expect(annaPage.getByRole("heading", { name: "Карточка заявки" })).toHaveCount(0);
  });

  test("несуществующие вложенные адреса отдают 404, а не 200", async ({ annaPage }) => {
    for (const path of ["/requests/does-not-exist", "/schedule/does-not-exist"]) {
      const response = await annaPage.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});

test.describe("Публичная регистрация", () => {
  test("создание аккаунта через API закрыто", async ({ page, baseURL }) => {
    const response = await page.request.post("/api/auth/sign-up/email", {
      headers: { origin: baseURL! },
      data: {
        email: "probe.signup@example.com",
        password: "ProbePass#2026",
        name: "Probe Signup",
      },
    });

    expect(response.ok()).toBe(false);
    expect(((await response.json()) as { code?: string }).code).toBe(
      "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    );

    const session = await page.request.get("/api/auth/get-session");
    expect(await session.json()).toBeNull();
  });
});
