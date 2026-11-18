import { describe, expect, it } from "vitest";

import type { RequestStatus } from "@/generated/prisma/enums";
import {
  buildRequestCreatedNotification,
  buildRequestStatusNotification,
  getRequestStatusDedupeKey,
} from "@/lib/domain/request-notifications";

const NUMBER = "З-2026-000123";

/** Разметка в тексте уведомления недопустима: он выводится как обычный текст. */
const HTML_PATTERN = /<[^>]*>/;

const ALL_STATUSES: RequestStatus[] = ["NEW", "IN_PROGRESS", "READY", "REJECTED", "CANCELLED"];

const EXPECTED_CONTENT: Record<RequestStatus, { title: string; priority: "NORMAL" | "IMPORTANT" }> =
  {
    NEW: { title: "Заявка создана", priority: "NORMAL" },
    IN_PROGRESS: { title: "Заявка принята в работу", priority: "NORMAL" },
    READY: { title: "Заявка готова", priority: "IMPORTANT" },
    REJECTED: { title: "Заявка отклонена", priority: "IMPORTANT" },
    CANCELLED: { title: "Заявка отменена", priority: "NORMAL" },
  };

describe("buildRequestCreatedNotification", () => {
  it("возвращает заголовок, текст и обычный приоритет", () => {
    expect(buildRequestCreatedNotification(NUMBER)).toEqual({
      title: "Заявка создана",
      priority: "NORMAL",
      body: `Заявка ${NUMBER} создана и ожидает рассмотрения. Следите за статусом в карточке заявки.`,
    });
  });

  it("подставляет номер заявки в текст", () => {
    const content = buildRequestCreatedNotification(NUMBER);

    expect(content.body).toContain(NUMBER);
    expect(content.body).toContain(`Заявка ${NUMBER}`);
    expect(content.title).not.toContain(NUMBER);
  });

  it("не содержит HTML-разметки", () => {
    const content = buildRequestCreatedNotification(NUMBER);

    expect(content.title).not.toMatch(HTML_PATTERN);
    expect(content.body).not.toMatch(HTML_PATTERN);
    expect(content.body).not.toContain("<");
    expect(content.body).not.toContain(">");
  });

  it("не содержит пустых частей", () => {
    const content = buildRequestCreatedNotification(NUMBER);

    expect(content.title.trim()).not.toBe("");
    expect(content.body.trim()).not.toBe("");
  });
});

describe("buildRequestStatusNotification", () => {
  it.each(ALL_STATUSES)("подписывает статус %s", (status) => {
    const content = buildRequestStatusNotification(status, NUMBER);

    expect(content.title).toBe(EXPECTED_CONTENT[status].title);
    expect(content.priority).toBe(EXPECTED_CONTENT[status].priority);
  });

  it.each(ALL_STATUSES)("добавляет номер заявки в текст для статуса %s", (status) => {
    const content = buildRequestStatusNotification(status, NUMBER);

    expect(content.body).toContain(NUMBER);
  });

  it.each(ALL_STATUSES)("не содержит HTML-разметки для статуса %s", (status) => {
    const content = buildRequestStatusNotification(status, NUMBER);

    expect(content.title).not.toMatch(HTML_PATTERN);
    expect(content.body).not.toMatch(HTML_PATTERN);
    expect(content.body).not.toContain("<");
    expect(content.body).not.toContain(">");
  });

  it("для NEW совпадает с уведомлением о создании", () => {
    expect(buildRequestStatusNotification("NEW", NUMBER)).toEqual(
      buildRequestCreatedNotification(NUMBER),
    );
  });

  it("даёт разные заголовки и тексты для разных статусов", () => {
    const titles = ALL_STATUSES.map(
      (status) => buildRequestStatusNotification(status, NUMBER).title,
    );
    const bodies = ALL_STATUSES.map(
      (status) => buildRequestStatusNotification(status, NUMBER).body,
    );

    expect(new Set(titles).size).toBe(ALL_STATUSES.length);
    expect(new Set(bodies).size).toBe(ALL_STATUSES.length);
  });

  it("помечает важными только готовность и отказ", () => {
    const important = ALL_STATUSES.filter(
      (status) => buildRequestStatusNotification(status, NUMBER).priority === "IMPORTANT",
    );

    expect(important).toEqual(["READY", "REJECTED"]);
  });
});

describe("getRequestStatusDedupeKey", () => {
  it("строит ключ из идентификатора заявки и записи истории", () => {
    expect(getRequestStatusDedupeKey("request_1", "history_1")).toBe(
      "request:request_1:status:history_1",
    );
  });

  it("соответствует ожидаемому формату", () => {
    expect(getRequestStatusDedupeKey("request_1", "history_1")).toMatch(
      /^request:[^:]+:status:[^:]+$/,
    );
  });

  it("детерминирован для одной и той же пары", () => {
    expect(getRequestStatusDedupeKey("request_1", "history_1")).toBe(
      getRequestStatusDedupeKey("request_1", "history_1"),
    );
  });

  it("различает события разных заявок и разных переходов", () => {
    const keys = [
      getRequestStatusDedupeKey("request_1", "history_1"),
      getRequestStatusDedupeKey("request_1", "history_2"),
      getRequestStatusDedupeKey("request_2", "history_1"),
      getRequestStatusDedupeKey("request_2", "history_2"),
      getRequestStatusDedupeKey("request_3", "history_3"),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });
});
