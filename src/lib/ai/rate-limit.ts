/**
 * Лимиты запросов к ИИ-помощнику (`docs/specs/p9-ai-assistant.md` § 4.4).
 *
 * Два скользящих окна на пользователя: 20 запросов за 10 минут и 100 запросов
 * в сутки. Хранилище — map с отметками времени в памяти процесса.
 *
 * Хранилище локально процессу (демо работает одним инстансом Next.js, а
 * спецификация запрещает менять схему Prisma ради лимитов). При нескольких
 * инстансах лимит считается по каждому отдельно — этого достаточно для демо и
 * не создаёт новых таблиц с персональными данными.
 */

/** Сколько запросов разрешено в коротком окне. */
export const AI_RATE_LIMIT_PER_WINDOW = 20;

/** Длина короткого окна: 10 минут. */
export const AI_RATE_WINDOW_MS = 10 * 60 * 1000;

/** Сколько запросов разрешено в сутки. */
export const AI_RATE_LIMIT_PER_DAY = 100;

/** Длина суточного окна: 24 часа. */
export const AI_RATE_DAY_MS = 24 * 60 * 60 * 1000;

export type AiRateLimiter = {
  /** Учитывает запрос; `false` — лимит исчерпан, отметка не ставится. */
  tryConsume(userId: string, now: Date): boolean;
  /** Полностью очищает хранилище: нужно тестам и сбросу демо. */
  reset(): void;
};

/**
 * Создаёт независимый лимитер: тесты получают собственный экземпляр с
 * фиксированными часами, прод — общий singleton ниже.
 */
export function createAiRateLimiter(): AiRateLimiter {
  const hits = new Map<string, number[]>();

  return {
    tryConsume(userId: string, now: Date): boolean {
      const at = now.getTime();
      // Записи старше суток не нужны ни одному окну: они удаляются первыми.
      const recent = (hits.get(userId) ?? []).filter(
        (timestamp) => timestamp > at - AI_RATE_DAY_MS,
      );
      // Строгое сравнение: запись ровно 10 минут назад уже не считается.
      const inWindow = recent.filter((timestamp) => timestamp > at - AI_RATE_WINDOW_MS);

      if (inWindow.length >= AI_RATE_LIMIT_PER_WINDOW || recent.length >= AI_RATE_LIMIT_PER_DAY) {
        // Просроченные записи всё равно сохраняем очищенными, чтобы map не рос.
        hits.set(userId, recent);
        return false;
      }

      recent.push(at);
      hits.set(userId, recent);

      return true;
    },

    reset(): void {
      hits.clear();
    },
  };
}

/** Общий лимитер маршрута в рамках процесса Next.js. */
export const aiRateLimiter: AiRateLimiter = createAiRateLimiter();
