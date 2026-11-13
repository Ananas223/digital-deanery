import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";

import { DEMO_STUDENTS, emailField, passwordField, STORAGE_STATE } from "./fixtures";

/**
 * Один раз входит двумя демо-студентами и сохраняет storage state.
 *
 * Отдельный проект `setup` нужен, чтобы сценарии не тратили попытки входа
 * и не упирались в rate limit Better Auth.
 */
const STUDENTS = [
  { data: DEMO_STUDENTS.anna, statePath: STORAGE_STATE.anna },
  { data: DEMO_STUDENTS.mark, statePath: STORAGE_STATE.mark },
];

for (const { data: student, statePath } of STUDENTS) {
  setup(`вход: ${student.name}`, async ({ page }) => {
    await page.goto("/login");

    await emailField(page).fill(student.email);
    await passwordField(page).fill(student.password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      `Здравствуйте, ${student.firstName}`,
    );

    await mkdir(STORAGE_STATE.dir, { recursive: true });
    await page.context().storageState({ path: statePath });
  });
}
