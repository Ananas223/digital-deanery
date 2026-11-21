import type { Page } from "@playwright/test";

import { expect, expectNoHorizontalScroll, SECTIONS, test } from "./fixtures";

// Run twice against the coordinator's isolated test server: flag=true with an
// explicitly empty AI_PROVIDER_API_KEY, then flag=false. No config override,
// real model, remote network, production stub or skipped test is involved.
const assistantEnabled = process.env["AI_ASSISTANT_ENABLED"] === "true";

async function openAssistant(page: Page) {
  const trigger = page.getByRole("button", { name: /^Блик/ }).first();
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Блик", exact: true });
  await expect(panel).toBeVisible();
  return { panel, trigger };
}

function visualStream(text: string, id: string) {
  const chunks = [
    { type: "start", messageId: id },
    { type: "text-start", id: "text" },
    { type: "text-delta", id: "text", delta: text },
    { type: "text-end", id: "text" },
    { type: "finish", finishReason: "stop" },
  ];
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test.describe(`Блик: ${viewport.width}px, flag=${assistantEnabled}`, () => {
    test.use({ viewport });

    test("реальный API без провайдера или с выключенным flag сохраняет ручные разделы", async ({
      annaPage,
    }) => {
      // Check before POST, so a misconfigured test never calls a real model.
      expect(
        Boolean(process.env["AI_PROVIDER_API_KEY"]?.trim()),
        "Для этого no-network сценария ключ должен отсутствовать",
      ).toBe(false);
      if (viewport.width === 360) await annaPage.setViewportSize({ width: 360, height: 636 });
      await annaPage.goto("/");
      await expect(annaPage.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      const api = await annaPage.request.post("/api/ai/chat", {
        data: {
          messages: [
            {
              id: "no-provider-question",
              role: "user",
              parts: [{ type: "text", text: "Что у меня сегодня?" }],
            },
          ],
        },
      });
      expect(api.status()).toBe(503);
      expect((await api.json()).error.code).toBe("AI_UNAVAILABLE");
      expect(api.headers()["cache-control"]).toContain("no-store");

      if (assistantEnabled) {
        const { panel } = await openAssistant(annaPage);
        await expect(
          panel.getByText(
            "Читаю только ваши данные. Не создаю и не меняю заявки, оценки и уведомления.",
            { exact: true },
          ),
        ).toBeVisible();
        const field = panel.getByRole("textbox", { name: "Ваш вопрос", exact: true });
        const send = panel.getByRole("button", { name: "Отправить вопрос", exact: true });
        const question = "Что с моими заявками?";
        await field.fill(question);
        const response = annaPage.waitForResponse(
          (response) =>
            response.url().endsWith("/api/ai/chat") && response.request().method() === "POST",
        );
        await send.click();
        expect((await response).status()).toBe(503);
        await expect(panel.getByRole("alert")).toContainText("Блик временно недоступен");
        await expect(panel.getByRole("list", { name: "История диалога" })).toContainText(question);
        if (viewport.width === 360) {
          // The no-keyboard error must not push either control out of the composer.
          await expect(field).toBeInViewport({ ratio: 1 });
          await expect(send).toBeInViewport({ ratio: 1 });
        }
        const retryResponse = annaPage.waitForResponse(
          (response) =>
            response.url().endsWith("/api/ai/chat") && response.request().method() === "POST",
        );
        await panel.getByRole("button", { name: "Повторить вопрос", exact: true }).click();
        expect((await retryResponse).status()).toBe(503);
        await expect(
          panel.getByRole("list", { name: "История диалога" }).getByRole("listitem"),
        ).toHaveCount(1);
        const manual = panel.getByRole("navigation", { name: "Разделы кабинета из помощника" });
        await expect(manual.getByRole("link")).toHaveCount(4);
        await manual.getByRole("link", { name: "Заявки", exact: true }).click();
        await expect(panel).toBeHidden();
        await expect(
          annaPage.getByRole("heading", { level: 1, name: "Заявки", exact: true }),
        ).toBeVisible();
      } else {
        await expect(annaPage.getByRole("button", { name: /^Блик/ })).toHaveCount(0);
        await expect(annaPage.locator("[data-assistant-panel], [data-blik-surface]")).toHaveCount(
          0,
        );
      }

      for (const section of SECTIONS) {
        await annaPage.goto(section.path);
        await expect(
          annaPage.getByRole("heading", { level: 1, name: section.label, exact: true }),
        ).toBeVisible();
        await expect(annaPage.getByRole("main").getByRole("alert")).toHaveCount(0);
        await expectNoHorizontalScroll(annaPage);
      }
      await annaPage.goto("/profile");
      await expect(
        annaPage.getByRole("heading", { level: 1, name: "Профиль", exact: true }),
      ).toBeVisible();
    });

    if (assistantEnabled) {
      test("синтетический поток только для UI: ожидание, два хода, частичный ответ, история и ручной переход", async ({
        annaPage,
      }, testInfo) => {
        testInfo.annotations.push({
          type: "synthetic-ui-only",
          description:
            "Browser route supplies a UI-message stream; this is not evidence of real model answers or data isolation.",
        });
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let received = () => {};
        const arrived = new Promise<void>((resolve) => {
          received = resolve;
        });
        const bodies: { messages: { role: string; parts: { type: string; text?: string }[] }[] }[] =
          [];
        await annaPage.route("**/api/ai/chat", async (route) => {
          bodies.push(route.request().postDataJSON());
          received();
          if (bodies.length === 1) await gate;
          const text =
            bodies.length === 1
              ? "Данные по разделу учёбы сейчас недоступны. Расписание можно открыть вручную: [Расписание](/schedule)."
              : "Для действий откройте [Заявки](/requests). Данные не изменены.";
          await route.fulfill({
            status: 200,
            headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
            body: visualStream(text, `visual-${bodies.length}`),
          });
        });
        await annaPage.goto("/");
        const { panel, trigger } = await openAssistant(annaPage);
        const field = panel.getByRole("textbox", { name: "Ваш вопрос", exact: true });
        await field.fill("Что у меня сегодня?");
        await panel.getByRole("button", { name: "Отправить вопрос", exact: true }).click();
        await arrived;
        try {
          await expect(panel.getByText("Готовлю ответ…", { exact: true })).toBeVisible();
          await expect(
            panel.getByRole("button", { name: "Остановить", exact: true }),
          ).toBeVisible();
          await expect(
            panel.getByRole("button", { name: "Отправить вопрос", exact: true }),
          ).toBeDisabled();
        } finally {
          release();
        }
        await expect(panel.getByRole("status")).toHaveText("Ответ Блика готов.");
        const history = panel.getByRole("list", { name: "История диалога" });
        await expect(history).toContainText("Данные по разделу учёбы сейчас недоступны");
        await expect(
          history.getByRole("link", { name: "Расписание", exact: true }),
        ).toHaveAttribute("href", "/schedule");
        await field.fill("А что с заявками?");
        await field.press("Enter");
        await expect(history.getByRole("listitem")).toHaveCount(4);
        await expect(panel.getByRole("status")).toHaveText("Ответ Блика готов.");
        expect(bodies).toHaveLength(2);
        expect(bodies[1]!.messages.map((message) => message.role)).toEqual([
          "user",
          "assistant",
          "user",
        ]);
        await panel.getByRole("button", { name: "Закрыть Блика" }).click();
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(history.getByRole("listitem")).toHaveCount(4);
        await history.getByRole("link", { name: "Заявки", exact: true }).click();
        await expect(annaPage).toHaveURL(/\/requests$/);
        await expect(panel).toBeHidden();
        await openAssistant(annaPage);
        await expect(history.getByRole("listitem")).toHaveCount(4);
        await annaPage.reload();
        const reopened = await openAssistant(annaPage);
        await expect(reopened.panel.getByRole("list", { name: "История диалога" })).toHaveCount(0);
        await expect(reopened.panel.getByRole("heading", { name: "С чего начнём?" })).toBeVisible();
        await expectNoHorizontalScroll(annaPage);
      });
    }
  });
}

if (assistantEnabled) {
  test.describe("Блик: ввод и доступная область на 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("IME, reduced motion и синтетическое сужение VisualViewport при фокусе", async ({
      annaPage,
    }, testInfo) => {
      testInfo.annotations.push({
        type: "synthetic-viewport",
        description:
          "VisualViewport height/offset simulation checks layout only; no physical or native virtual keyboard was tested.",
      });
      await annaPage.emulateMedia({ reducedMotion: "reduce" });
      await annaPage.route("**/api/ai/chat", (route) =>
        route.fulfill({
          status: 200,
          headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
          body: visualStream("Проверка интерфейса завершена.", "ime-visual"),
        }),
      );
      await annaPage.goto("/");
      const { panel, trigger } = await openAssistant(annaPage);
      const field = panel.getByRole("textbox", { name: "Ваш вопрос", exact: true });
      await field.fill("Проверка ввода");
      await field.focus();
      await field.evaluate((element: HTMLTextAreaElement) => {
        element.form!.dataset["submitCount"] = "0";
        element.form!.addEventListener("submit", () => {
          element.form!.dataset["submitCount"] = String(
            Number(element.form!.dataset["submitCount"]) + 1,
          );
        });
      });
      await field.dispatchEvent("keydown", {
        key: "Enter",
        code: "Enter",
        isComposing: true,
        keyCode: 13,
      });
      await field.dispatchEvent("keydown", {
        key: "Enter",
        code: "Enter",
        isComposing: false,
        keyCode: 229,
      });
      await expect(field).toHaveValue("Проверка ввода");
      await expect(panel.locator("form")).toHaveAttribute("data-submit-count", "0");
      await field.press("Shift+Enter");
      await expect(field).toHaveValue("Проверка ввода\n");
      const navigation = annaPage.getByRole("navigation", {
        name: "Разделы кабинета",
        exact: true,
      });
      await expect(navigation).toBeVisible();
      const originalBounds = await panel.boundingBox();
      const navBounds = await navigation.boundingBox();
      expect(originalBounds!.y + originalBounds!.height).toBeLessThanOrEqual(navBounds!.y + 1);
      await annaPage.evaluate(() => {
        const viewport = window.visualViewport!;
        Object.defineProperty(viewport, "height", { configurable: true, value: 420 });
        Object.defineProperty(viewport, "offsetTop", { configurable: true, value: 24 });
        viewport.dispatchEvent(new Event("resize"));
      });
      await expect.poll(async () => (await panel.boundingBox())!.y).toBe(24);
      await expect(field).toBeFocused();
      await expect(field).toBeInViewport({ ratio: 1 });
      const fieldBounds = await field.boundingBox();
      expect(fieldBounds!.y).toBeGreaterThanOrEqual(24);
      expect(fieldBounds!.y + fieldBounds!.height).toBeLessThanOrEqual(444);
      const keyboardNav = await navigation.boundingBox();
      const keyboardPanel = await panel.boundingBox();
      expect(keyboardPanel!.y + keyboardPanel!.height).toBeCloseTo(keyboardNav!.y, 0);
      expect(keyboardNav!.y + keyboardNav!.height).toBeCloseTo(444, 0);
      const send = panel.getByRole("button", { name: "Отправить вопрос", exact: true });
      await expect(send).toBeInViewport({ ratio: 1 });
      const animations = await panel
        .locator("svg [data-blik-pose], svg [data-blik-auto-gaze], svg [data-blik-eyes]")
        .evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).animationName),
        );
      expect(animations).toHaveLength(3);
      expect(animations).toEqual(["none", "none", "none"]);
      await field.press("Enter");
      await expect(panel.getByRole("status")).toHaveText("Ответ Блика готов.");
      await expect(panel.locator("form")).toHaveAttribute("data-submit-count", "1");
      await expect(send).toBeInViewport({ ratio: 1 });
      await annaPage.evaluate(() => {
        const viewport = window.visualViewport!;
        Object.defineProperty(viewport, "height", { configurable: true, value: innerHeight });
        Object.defineProperty(viewport, "offsetTop", { configurable: true, value: 0 });
        viewport.dispatchEvent(new Event("resize"));
      });
      await expect
        .poll(async () => (await panel.boundingBox())!.height)
        .toBe(originalBounds!.height);
      await expect.poll(async () => (await navigation.boundingBox())!.y).toBe(navBounds!.y);
      await expectNoHorizontalScroll(annaPage);
      await field.press("Escape");
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await field.focus();
      await annaPage.evaluate(() => {
        const viewport = window.visualViewport!;
        Object.defineProperty(viewport, "height", { configurable: true, value: 420 });
        viewport.dispatchEvent(new Event("resize"));
      });
      await expect
        .poll(async () => {
          const bounds = (await navigation.boundingBox())!;
          return Math.round(bounds.y + bounds.height);
        })
        .toBe(420);
      await navigation.getByRole("link", { name: "Заявки", exact: true }).click();
      await expect(annaPage).toHaveURL(/\/requests$/);
      await expect(panel).toBeHidden();
    });
  });
}
