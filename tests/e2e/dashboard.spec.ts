import { expect, expectNoHorizontalScroll, test } from "./fixtures";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test.describe(`Главная: ${viewport.width}px`, () => {
    test.use({ viewport });

    test("живая сводка и быстрые действия открывают рабочие разделы", async ({ annaPage }) => {
      const started = Date.now();
      await annaPage.goto("/");
      const main = annaPage.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(main.getByRole("region", { name: "Занятия сегодня" })).toBeVisible();
      await expect(main.getByRole("region", { name: "Учёба", exact: true })).toBeVisible();
      await expect(main.getByText("Средний балл", { exact: true })).toBeVisible();
      await expect(main.getByText("Задолженности", { exact: true })).toBeVisible();
      await expect(main.getByRole("region", { name: "Активные заявки" })).toBeVisible();
      await expect(main.getByRole("region", { name: "Уведомления", exact: true })).toBeVisible();
      await expect(main.getByRole("heading", { name: "Утренний бриф", exact: true })).toBeVisible();
      const briefCards = main.getByRole("region", {
        name: /Сейчас|Далее|Изменилось|Требует действия/,
      });
      if ((await briefCards.count()) === 0) {
        await expect(main.getByText("Пока всё спокойно", { exact: true })).toBeVisible();
      } else {
        await expect(briefCards.first()).toBeVisible();
      }
      expect(Date.now() - started).toBeLessThan(60_000);
      await expectNoHorizontalScroll(annaPage);

      const targets = [
        { name: "Заказать справку", path: "/requests/new", heading: "Новая заявка" },
        { name: "Расписание на неделю", path: "/schedule?view=week", heading: "Расписание" },
        { name: "Все оценки", path: "/grades", heading: "Успеваемость" },
      ];
      for (const target of targets) {
        await test.step(target.name, async () => {
          await annaPage.goto("/");
          const actions = annaPage.getByRole("region", { name: "Быстрые действия" });
          await actions.getByRole("link", { name: target.name, exact: true }).click();
          await expect(annaPage).toHaveURL(new RegExp(`${target.path.replace("?", "\\?")}$`));
          await expect(
            annaPage.getByRole("heading", { level: 1, name: target.heading }),
          ).toBeVisible();
          await expectNoHorizontalScroll(annaPage);
        });
      }
    });

    test("сводка ведёт к оценкам, активной заявке и уведомлению своей категории", async ({
      annaPage,
    }) => {
      await annaPage.goto("/");
      const study = annaPage.getByRole("region", { name: "Учёба", exact: true });
      await study.getByRole("link", { name: "Все оценки", exact: true }).click();
      await expect(annaPage.getByRole("heading", { level: 1, name: "Успеваемость" })).toBeVisible();
      await annaPage.goto("/");

      const nextExam = study.locator('a[href*="tab=session"]');
      await expect(nextExam).toHaveCount(1);
      const examTitle = await nextExam.locator("p").first().innerText();
      const examHref = await nextExam.getAttribute("href");
      expect(examHref).toBeTruthy();
      const examDestination = new URL(examHref!, annaPage.url()).href;
      await nextExam.click();
      await expect(annaPage).toHaveURL(examDestination);
      await expect(annaPage.locator("#discipline-detail-heading")).toHaveText(examTitle);
      await expectNoHorizontalScroll(annaPage);
      await annaPage.goto("/");

      const requests = annaPage.getByRole("region", { name: "Активные заявки" });
      const request = requests.locator('a[href^="/requests/"]').first();
      await expect(request).toBeVisible();
      const requestHref = await request.getAttribute("href");
      const requestNumber = await request.locator("span").first().innerText();
      await request.click();
      await expect(annaPage).toHaveURL(new RegExp(`${requestHref}$`));
      await expect(annaPage.getByRole("main")).toContainText(requestNumber);
      await expect(
        annaPage.getByRole("heading", { name: "История обработки", exact: true }),
      ).toBeVisible();
      await annaPage.goto("/");

      const notifications = annaPage.getByRole("region", { name: "Уведомления", exact: true });
      const notification = notifications.locator("li a").first();
      await expect(notification).toBeVisible();
      const title = await notification.locator("p").innerText();
      const notificationHref = await notification.getAttribute("href");
      expect(notificationHref).toMatch(/^\/notifications\?category=/);
      await notification.click();
      await expect(annaPage).toHaveURL(new RegExp(`${notificationHref!.replace("?", "\\?")}$`));
      const article = annaPage.getByRole("article", { name: title, exact: true });
      await expect(article).toBeVisible();
      await article.getByRole("button", { name: title, exact: true }).click();
      await expect(article.getByRole("button", { name: title, exact: true })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expectNoHorizontalScroll(annaPage);

      await annaPage.goto("/");
      await annaPage
        .getByRole("complementary", { name: "Сводка кабинета" })
        .getByRole("link", { name: /Профиль/ })
        .click();
      await expect(annaPage).toHaveURL(/\/profile$/);
      await expect(annaPage.getByRole("heading", { level: 1, name: "Профиль" })).toBeVisible();
    });

    test("занятие открывает сведения на главной, сохраняя адрес и фокус; пустой день объяснён", async ({
      annaPage,
    }, testInfo) => {
      await annaPage.goto("/");
      const main = annaPage.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
      const lessons = main.locator("[data-lesson-trigger]");
      // This is the server's real Moscow day. A day without lessons is a valid state,
      // not evidence that a lesson was opened; record that distinction in the report.
      await expect(
        lessons
          .first()
          .or(main.getByRole("heading", { name: "На сегодня занятий нет", exact: true })),
      ).toBeVisible();
      if ((await lessons.count()) === 0) {
        await expect(
          main.getByRole("heading", { name: "На сегодня занятий нет", exact: true }),
        ).toBeVisible();
        await main.getByRole("link", { name: "Расписание на неделю", exact: true }).first().click();
        await expect(annaPage).toHaveURL(/\/schedule\?view=week$/);
        testInfo.annotations.push({
          type: "real-empty-day",
          description:
            "Занятие отсутствует в реальном дне; открытие панели этим запуском не подтверждено.",
        });
        return;
      }
      const origin = lessons.first();
      const title = await origin.getByRole("heading", { level: 3 }).innerText();
      const originalUrl = annaPage.url();
      await origin.click();
      const panel = annaPage.getByRole("dialog");
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(
        panel.getByText("Аудитория и корпус", { exact: true }).first().locator("..").locator("dd"),
      ).not.toBeEmpty();
      await expect(
        panel.getByText("Преподаватель", { exact: true }).first().locator("..").locator("dd"),
      ).not.toBeEmpty();
      await expect(annaPage).toHaveURL(originalUrl);
      await panel.getByRole("button", { name: "Закрыть подробности" }).click();
      await expect(panel).toBeHidden();
      await expect(origin).toBeFocused();
      await expect(annaPage).toHaveURL(originalUrl);
      await expectNoHorizontalScroll(annaPage);
    });
  });
}
