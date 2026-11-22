import { createAiChatHandler } from "@/lib/ai/chat-handler";
import { createAiModel, isAiEnabled } from "@/lib/ai/provider";
import { aiRateLimiter } from "@/lib/ai/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

/**
 * `POST /api/ai/chat` (`docs/specs/p9-ai-assistant.md` § 4.4).
 *
 * Тонкий адаптер Next.js: подключает сессию, окружение и общий лимитер к
 * обработчику из `chat-handler.ts`. Никакой Prisma и второй проверки прав
 * здесь нет — доступ решается в серверном слое рядом с данными.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createAiChatHandler({
  // `requireUser` читает `next/headers`: только отсутствие сессии — гость.
  // Остальные сбои (база, конфигурация) пробрасываются, чтобы обработчик
  // залогировал их и ответил `500 INTERNAL` с `requestId`, а не `401`.
  getUser: async () => {
    try {
      return await requireUser();
    } catch (error) {
      if (error instanceof AppError && error.code === "UNAUTHORIZED") {
        return null;
      }

      throw error;
    }
  },
  isEnabled: () => isAiEnabled(),
  createModel: () => createAiModel(),
  limiter: aiRateLimiter,
  now: () => new Date(),
});

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
