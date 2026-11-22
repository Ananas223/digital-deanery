import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { getStudentProfile } from "@/lib/domain/profile";
import { getWeekSchedule } from "@/lib/domain/schedule";
import { buildScheduleIcs } from "@/lib/domain/schedule-ics";
import { AppError, toPublicError, type ErrorCode } from "@/lib/errors";
import { parseScheduleDate } from "@/lib/ui/schedule-query";

/**
 * `GET /api/schedule/export?week=ГГГГ-ММ-ДД` (`docs/specs/p2-schedule-ui.md` § 4.4).
 *
 * Тонкий Route Handler: сессия и группа определяются на сервере, выбор недели
 * повторяет `/schedule`. Клиентский `userId` не принимается, публичной
 * подписки по ссылке нет. `week` — любой день недели; отсутствие параметра
 * означает текущую неделю.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  /** Единый JSON-ответ ошибки: реальный статус, без кеша и без деталей. */
  function fail(code: ErrorCode): Response {
    const error = new AppError(code);

    return Response.json(toPublicError(error, requestId), {
      status: error.status,
      headers: { ...NO_STORE_HEADERS, "x-request-id": requestId },
    });
  }

  const weekParam = new URL(request.url).searchParams.get("week");
  let weekOf = new Date();

  if (weekParam !== null) {
    const parsed = parseScheduleDate(weekParam);

    if (!parsed) {
      return fail("VALIDATION");
    }

    weekOf = parsed;
  }

  let user: CurrentUser;

  try {
    user = await requireUser();
  } catch (error) {
    // Гость — это только отсутствие сессии; остальные сбои не маскируем под 401.
    if (error instanceof AppError && error.code === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED");
    }

    throw error;
  }

  const [week, profile] = await Promise.all([
    getWeekSchedule(user.id, weekOf),
    getStudentProfile(user.id),
  ]);

  if (!week) {
    return fail("NOT_FOUND");
  }

  const firstLesson = week.days.flatMap((day) => day.lessons)[0];
  const groupCode = profile?.group ?? firstLesson?.groupCode;
  const body = buildScheduleIcs(week, { groupCode });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="schedule-${week.weekStart}.ics"`,
      ...NO_STORE_HEADERS,
      "x-request-id": requestId,
    },
  });
}
