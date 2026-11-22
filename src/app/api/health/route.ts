import { prisma } from "@/lib/db/prisma";

/**
 * `GET /api/health` — проба живости приложения для контейнера (`HEALTHCHECK`).
 *
 * Маршрут публичный и намеренно «скучный»: ни сессии, ни пользовательских
 * данных, ни деталей сбоя. Проверка базы — минимальный `SELECT 1`, чтобы проба
 * замечала потерю соединения, а не только живой процесс Node.js.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

function healthResponse(database: "ok" | "unavailable"): Response {
  const healthy = database === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { database },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: NO_STORE_HEADERS },
  );
}

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return healthResponse("ok");
  } catch {
    // Наружу — только факт недоступности. Текст ошибки может содержать строку
    // подключения и SQL, поэтому он не возвращается и не логируется.
    return healthResponse("unavailable");
  }
}
