import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";

import { DEMO_EMPLOYEE, DEMO_STUDENTS, emailField, passwordField, STORAGE_STATE } from "./fixtures";

/**
 * Один раз входит демо-аккаунтами и сохраняет storage state.
 *
 * Отдельный проект `setup` нужен, чтобы сценарии не тратили попытки входа
 * и не упирались в rate limit Better Auth.
 */
const ACCOUNTS = [
  { data: DEMO_STUDENTS.anna, statePath: STORAGE_STATE.anna },
  { data: DEMO_STUDENTS.mark, statePath: STORAGE_STATE.mark },
  { data: DEMO_EMPLOYEE, statePath: STORAGE_STATE.employee },
];

for (const { data: account, statePath } of ACCOUNTS) {
  setup(`вход: ${account.name}`, async ({ page }) => {
    await page.goto("/login");

    await emailField(page).fill(account.email);
    await passwordField(page).fill(account.password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      `Здравствуйте, ${account.firstName}`,
    );

    await mkdir(STORAGE_STATE.dir, { recursive: true });
    await page.context().storageState({ path: statePath });
  });
}
