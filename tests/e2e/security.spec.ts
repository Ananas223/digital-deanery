import { DEMO_STUDENTS, expect, test } from "./fixtures";

/**
 * US-10, AGENTS.md § 3.2: разделение данных между аккаунтами.
 *
 * На этапе 0 профиль — единственный персональный ресурс. Проверяем, что:
 * - сессия одного студента не отдаёт данные другого;
 * - гость не читает защищённые разделы;
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
});
