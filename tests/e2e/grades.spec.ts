import type { Page } from "@playwright/test";

import { expect, expectNoHorizontalScroll, test } from "./fixtures";

const sizes = [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
];

async function openGrades(page: Page) {
  await page.goto("/grades");
  await expect(page.getByRole("heading", { name: "Успеваемость", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Дисциплины и результаты" })).toBeVisible();
  const semesters = page.getByRole("navigation", { name: "Семестры" });
  await expect(semesters.getByRole("link")).toHaveCount(2);
  const selected = semesters.locator('[aria-current="page"]');
  return { semesters, currentHref: (await selected.getAttribute("href"))! };
}

async function expectTitlesFit(page: Page) {
  const titles = page.locator("#grades-content h3 a, #discipline-detail-heading");
  expect(await titles.count()).toBeGreaterThan(0);
  const measurements = await titles.evaluateAll((elements) =>
    elements.map((element) => ({
      text: element.textContent,
      scroll: element.scrollWidth,
      width: element.clientWidth,
      clamp: getComputedStyle(element).webkitLineClamp,
      ellipsis: getComputedStyle(element).textOverflow,
    })),
  );
  for (const title of measurements) {
    expect(title.scroll, title.text ?? "Название дисциплины").toBeLessThanOrEqual(title.width + 1);
    expect(title.clamp).toBe("none");
    expect(title.ellipsis).not.toBe("ellipsis");
  }
  await expectNoHorizontalScroll(page);
}

for (const viewport of sizes) {
  test.describe(`US-04/05: успеваемость ${viewport.width}px`, () => {
    test.use({ viewport });

    test("сводка и невыставленный результат доступны, история сохраняется после обновления", async ({
      annaPage: page,
    }) => {
      const { semesters, currentHref } = await openGrades(page);
      const summary = page.getByRole("region", { name: "Итог семестра" });
      await expect(summary).toContainText("Учёба в норме, задолженностей нет.");
      await expect(summary).toContainText("4,67 из 5");
      await expect(summary).toContainText("получено 12 из 14");
      const disciplines = page.getByRole("region", { name: "Дисциплины и результаты" });
      await expect(disciplines.getByRole("listitem")).toHaveCount(5);
      const pending = disciplines
        .getByRole("listitem")
        .filter({ hasText: "Экономическая география" });
      await expect(pending).toContainText("Не выставлено");
      await expect(pending).toContainText("Курсовая работа");
      await expect(pending).toContainText("Зачётные единицы");
      await expect(
        disciplines.getByRole("link", { name: "Иностранный язык (английский)", exact: true }),
      ).toBeVisible();
      await expectTitlesFit(page);
      const past = semesters.getByRole("link").last();
      const pastHref = await past.getAttribute("href");
      expect(pastHref).toBeTruthy();
      expect(pastHref).not.toBe(currentHref);
      await past.click();
      await expect(
        page.getByRole("region", { name: "Дисциплины и результаты" }).getByRole("listitem"),
      ).toHaveCount(4);
      await expect(page.locator("main")).toContainText("Результаты доступны только для просмотра.");
      await expect(page.getByRole("region", { name: "Итог семестра" })).toContainText("5 из 5");
      const pastId = new URL(pastHref!, page.url()).searchParams.get("semesterId");
      expect(new URL(page.url()).searchParams.get("semesterId")).toBe(pastId);
      await page.reload();
      await expect(semesters.locator('[aria-current="page"]')).toHaveAttribute("href", pastHref!);
      await expect(
        page.getByRole("region", { name: "Дисциплины и результаты" }).getByRole("listitem"),
      ).toHaveCount(4);
      await expectTitlesFit(page);
      await page.goto(currentHref);
      await expect(
        page.getByRole("region", { name: "Дисциплины и результаты" }).getByRole("listitem"),
      ).toHaveCount(5);
    });

    test("задолженности Марка ведут к проблемной дисциплине и сохраняют семестр", async ({
      markPage: page,
    }) => {
      const { currentHref } = await openGrades(page);
      const summary = page.getByRole("region", { name: "Итог семестра" });
      await expect(summary).toContainText("Есть задолженности: 2 задолженности.");
      await expect(summary).toContainText("2,5 из 5");
      await expect(summary).toContainText("получено 5 из 14");
      const debts = summary
        .getByRole("heading", { name: "Дисциплины с задолженностью" })
        .locator("..");
      await expect(debts.getByRole("link")).toHaveCount(2);
      await expect(debts.getByRole("link", { name: "Микроэкономика", exact: true })).toBeVisible();
      await expect(
        debts.getByRole("link", { name: "Бухгалтерский учёт", exact: true }),
      ).toBeVisible();
      await expect(
        debts.getByRole("link", { name: "Основы предпринимательства", exact: true }),
      ).toHaveCount(0);
      await debts.getByRole("link", { name: "Микроэкономика", exact: true }).focus();
      await page.keyboard.press("Enter");
      const detail = page.locator("#discipline-detail");
      await expect(
        detail.getByRole("heading", { name: "Микроэкономика", exact: true }),
      ).toBeVisible();
      await expect(detail).toContainText("2 из 5");
      await expect(detail).toContainText("Незачёт");
      await expect(detail).toContainText("Преподаватель");
      await expect(detail).toContainText("Экзамен");
      await expect(detail).toContainText("Зачётные единицы");
      expect(new URL(page.url()).searchParams.get("semesterId")).toBe(
        new URL(currentHref, page.url()).searchParams.get("semesterId"),
      );
      await expectTitlesFit(page);
      await detail.getByRole("link", { name: "К списку дисциплин", exact: true }).click();
      await expect(detail).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Дисциплины и результаты" })).toBeVisible();
      expect(new URL(page.url()).searchParams.has("disciplineId")).toBe(false);
      await expect(summary).toContainText("2 задолженности");
    });

    test("сессия показывает времена, места, результаты и ближайший контроль из реальных записей", async ({
      annaPage: page,
    }) => {
      const { semesters } = await openGrades(page);
      await page
        .getByRole("navigation", { name: "Раздел успеваемости" })
        .getByRole("link", { name: "Сессия", exact: true })
        .click();
      const rows = page.locator("#grades-content li");
      await expect(rows).toHaveCount(4);
      const records: { title: string; startsAt: number; endsAt: number }[] = [];
      for (const row of await rows.all()) {
        const title = await row.getByRole("heading", { level: 3 }).innerText();
        const times = row.locator("dl time");
        await expect(times).toHaveCount(2);
        const start = await times.nth(0).getAttribute("datetime");
        const end = await times.nth(1).getAttribute("datetime");
        expect(start).toBeTruthy();
        expect(end).toBeTruthy();
        const startsAt = new Date(start!).getTime();
        const endsAt = new Date(end!).getTime();
        expect(endsAt).toBeGreaterThan(startsAt);
        records.push({ title, startsAt, endsAt });
        await expect(row).toContainText("Начало, МСК");
        await expect(row).toContainText("Окончание, МСК");
        await expect(row).toContainText("Форма контроля");
        await expect(row).toContainText("Ауд.");
        await expect(row).toContainText("корпус");
        await expect(row).toContainText("Преподаватель");
        await expect(row).toContainText("Результат");
        const group = row.locator("xpath=ancestor::section[1]");
        await expect(group.getByRole("heading", { level: 2 })).toHaveText(
          endsAt > Date.now() ? "Предстоящие и текущие" : "Прошедшие",
        );
      }
      const upcoming = records
        .filter((exam) => exam.endsAt > Date.now())
        .sort((a, b) => a.startsAt - b.startsAt);
      expect(upcoming.length).toBeGreaterThan(0);
      const nearest = upcoming[0]!;
      const summary = page.getByRole("region", { name: "Итог семестра" });
      await expect(summary.getByRole("link", { name: nearest.title, exact: true })).toBeVisible();
      await summary.getByRole("link", { name: nearest.title, exact: true }).click();
      const detail = page.locator("#discipline-detail");
      await expect(detail.getByRole("heading", { name: nearest.title, exact: true })).toBeVisible();
      await expect(detail).toContainText("Сессия по дисциплине");
      await expect(detail).toContainText("Форма контроля");
      await expect(detail).toContainText("Преподаватель");
      expect(new URL(page.url()).searchParams.get("tab")).toBe("session");
      await detail.getByRole("link", { name: "К списку сессии", exact: true }).click();
      await expect(detail).toHaveCount(0);
      await expect(rows).toHaveCount(4);
      await semesters.getByRole("link").last().click();
      await expect(page.getByRole("region", { name: "Прошедшие", exact: true })).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Предстоящие и текущие", exact: true }),
      ).toHaveCount(0);
      await expect(page.locator("#grades-content")).toContainText(
        "Предстоящих испытаний в этом семестре нет.",
      );
      await expect(rows).toHaveCount(4);
      await page
        .getByRole("navigation", { name: "Раздел успеваемости" })
        .getByRole("link", { name: "Оценки", exact: true })
        .click();
      await expect(page.getByRole("region", { name: "Дисциплины и результаты" })).toBeVisible();
      await expectTitlesFit(page);
    });

    test("неизвестный семестр и чужая дисциплина объясняются без раскрытия данных", async ({
      annaPage: page,
      markPage,
    }) => {
      await openGrades(markPage);
      const foreignHref = await markPage.locator("#grades-content a").first().getAttribute("href");
      expect(foreignHref).toBeTruthy();
      await page.goto(foreignHref!);
      await expect(
        page.getByRole("heading", { name: "Дисциплина не найдена", exact: true }),
      ).toBeVisible();
      await expect(page.locator("#discipline-detail")).not.toContainText("Микроэкономика");
      await expect(page.getByRole("region", { name: "Дисциплины и результаты" })).toContainText(
        "История международных отношений",
      );
      await page
        .locator("#discipline-detail")
        .getByRole("link", { name: "К списку дисциплин", exact: true })
        .click();
      await expect(page.locator("#discipline-detail")).toHaveCount(0);
      await page.goto("/grades?semesterId=unavailable-semester&tab=session");
      await expect(
        page.getByRole("heading", { name: "Семестр не найден", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("region", { name: "Итог семестра" })).toHaveCount(0);
      await page.getByRole("link", { name: "К доступному семестру", exact: true }).click();
      expect(new URL(page.url()).searchParams.get("tab")).toBe("session");
      await expect(page.locator("#grades-content li")).toHaveCount(4);
      await expectNoHorizontalScroll(page);
    });

    test("US-14: прогноз красного диплома и «а если?» объясняют расчёт", async ({
      annaPage: page,
      markPage,
    }) => {
      await openGrades(page);
      const forecast = page.getByRole("region", { name: "Прогноз красного диплома" });
      await expect(forecast).toBeVisible();
      await expect(forecast).toContainText("75 %");
      await expect(forecast).toContainText("67 %");
      await expect(forecast).toContainText("Нужно ещё 1 оценка «отлично»");
      await expect(forecast).toContainText("в расчёт не входят");

      const whatIf = page.getByRole("region", { name: "А если?" });
      await expect(whatIf).toBeVisible();
      await expect(whatIf.getByLabel("Дисциплина без оценки").locator("option")).toHaveCount(1);
      await expect(whatIf).toContainText("Нужен балл 4");
      await whatIf.getByLabel("Целевое среднее").selectOption("5");
      await expect(whatIf).toContainText("Цель недостижима");
      await expectNoHorizontalScroll(page);

      await openGrades(markPage);
      const markForecast = markPage.getByRole("region", { name: "Прогноз красного диплома" });
      await expect(markForecast).toBeVisible();
      await expect(markForecast).toContainText("Красный диплом недостижим");
      await expect(markForecast).toContainText("3 или ниже");
      await expectNoHorizontalScroll(markPage);
    });
  });
}
