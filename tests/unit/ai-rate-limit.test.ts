import { describe, expect, it } from "vitest";

import {
  AI_RATE_DAY_MS,
  AI_RATE_LIMIT_PER_DAY,
  AI_RATE_LIMIT_PER_WINDOW,
  AI_RATE_WINDOW_MS,
  createAiRateLimiter,
} from "@/lib/ai/rate-limit";

const USER = "user-anna";
const OTHER_USER = "user-mark";
const START = new Date("2026-11-19T09:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs);
}

/** Набирает `count` успешных запросов в одну и ту же минуту. */
function consume(
  limiter: ReturnType<typeof createAiRateLimiter>,
  count: number,
  now: Date,
): number {
  let accepted = 0;

  for (let index = 0; index < count; index += 1) {
    if (limiter.tryConsume(USER, now)) {
      accepted += 1;
    }
  }

  return accepted;
}

describe("лимитер ИИ-помощника", () => {
  it("пропускает 20 запросов за 10 минут и отклоняет 21-й", () => {
    const limiter = createAiRateLimiter();

    expect(consume(limiter, AI_RATE_LIMIT_PER_WINDOW, START)).toBe(AI_RATE_LIMIT_PER_WINDOW);
    expect(limiter.tryConsume(USER, START)).toBe(false);
    // Отказ не съедает окно: следующий запрос в ту же минуту тоже отклонён.
    expect(limiter.tryConsume(USER, at(60_000))).toBe(false);
  });

  it("считает отказы независимо от пользователя", () => {
    const limiter = createAiRateLimiter();

    consume(limiter, AI_RATE_LIMIT_PER_WINDOW, START);

    expect(limiter.tryConsume(USER, START)).toBe(false);
    expect(limiter.tryConsume(OTHER_USER, START)).toBe(true);
  });

  it("освобождает окно ровно через 10 минут", () => {
    const limiter = createAiRateLimiter();

    consume(limiter, AI_RATE_LIMIT_PER_WINDOW, START);

    // За миллисекунду до границы записи ещё в окне.
    expect(limiter.tryConsume(USER, at(AI_RATE_WINDOW_MS - 1))).toBe(false);
    // Ровно на границе старые отметки уже не считаются.
    expect(limiter.tryConsume(USER, at(AI_RATE_WINDOW_MS))).toBe(true);
    expect(consume(limiter, AI_RATE_LIMIT_PER_WINDOW - 1, at(AI_RATE_WINDOW_MS))).toBe(
      AI_RATE_LIMIT_PER_WINDOW - 1,
    );
    expect(limiter.tryConsume(USER, at(AI_RATE_WINDOW_MS))).toBe(false);
  });

  it("держит суточный потолок в 100 запросов", () => {
    const limiter = createAiRateLimiter();
    // Раз в 14 минут: короткое окно никогда не заполняется, а все 100 запросов
    // укладываются в сутки (99 интервалов = 23,1 часа).
    const step = 14 * 60 * 1000;
    const lastOffset = (AI_RATE_LIMIT_PER_DAY - 1) * step;
    let accepted = 0;

    for (let index = 0; index < AI_RATE_LIMIT_PER_DAY; index += 1) {
      if (limiter.tryConsume(USER, at(index * step))) {
        accepted += 1;
      }
    }

    expect(lastOffset).toBeLessThan(AI_RATE_DAY_MS);
    expect(accepted).toBe(AI_RATE_LIMIT_PER_DAY);
    expect(limiter.tryConsume(USER, at(lastOffset))).toBe(false);
    expect(limiter.tryConsume(USER, at(lastOffset + 60_000))).toBe(false);
    // Ровно через сутки первая отметка выпадает из окна и запрос снова проходит.
    expect(limiter.tryConsume(USER, at(AI_RATE_DAY_MS))).toBe(true);
  });

  it("сбрасывается полностью", () => {
    const limiter = createAiRateLimiter();

    consume(limiter, AI_RATE_LIMIT_PER_WINDOW, START);
    expect(limiter.tryConsume(USER, START)).toBe(false);

    limiter.reset();

    expect(limiter.tryConsume(USER, START)).toBe(true);
  });
});
