import { randomUUID } from "node:crypto";

import type { LanguageModelV3StreamPart, LanguageModelV3Usage } from "@ai-sdk/provider";
import { simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it, vi, type Mock } from "vitest";

import { createAiChatHandler, type AiChatDeps, type AiChatUser } from "@/lib/ai/chat-handler";
import type { AiLogFields } from "@/lib/ai/observability";
import { AI_RATE_LIMIT_PER_WINDOW, createAiRateLimiter } from "@/lib/ai/rate-limit";
import type {
  GradesAnswer,
  NotificationsAnswer,
  RequestsAnswer,
  UpcomingAnswer,
} from "@/lib/ai/tool-schemas";
import { createAiTools } from "@/lib/ai/tools";
import { createPrismaClient } from "@/lib/db/client";
import { AppError, type PublicError } from "@/lib/errors";
import { AI_MAX_BODY_BYTES } from "@/lib/validation/ai";

/**
 * Интеграционные проверки `POST /api/ai/chat` без сети и без Next.js:
 * обработчик создаётся с внедрёнными зависимостями, модель — мок AI SDK.
 *
 * Маршрут (`src/app/api/ai/chat/route.ts`) не импортируется: он читает
 * `next/headers` и вне запроса не работает. Здесь тестируется тот же
 * обработчик, который маршрут подключает в проде.
 */

const prisma = createPrismaClient();

const NOW = new Date("2026-11-19T09:00:00.000Z");

const ANNA_EMAIL = "anna.petrova@example.com";
const MARK_EMAIL = "mark.sokolov@example.com";

type Student = { id: string; name: string };

let anna: Student;
let mark: Student;

/** Заявка Марка и его номер: чужие данные не должны попадать в ответ Анны. */
let markRequestId: string;
let markRequestNumber: string;

const createdRequestIds: string[] = [];

const LOG_FIELDS = new Set<keyof AiLogFields>([
  "requestId",
  "stepNumber",
  "finishReason",
  "inputTokens",
  "outputTokens",
  "toolNames",
  "durationMs",
  "errorName",
  "statusCode",
]);

const USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

async function findStudent(email: string): Promise<Student> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return user;
}

beforeAll(async () => {
  [anna, mark] = await Promise.all([findStudent(ANNA_EMAIL), findStudent(MARK_EMAIL)]);

  const markRequest = await prisma.request.findFirst({
    where: { student: { userId: mark.id } },
    orderBy: { createdAt: "desc" },
    select: { id: true, number: true },
  });

  if (markRequest) {
    markRequestId = markRequest.id;
    markRequestNumber = markRequest.number;

    return;
  }

  // Seed всегда содержит заявки Марка; страховка на случай изменённого seed.
  const type = await prisma.requestType.findFirstOrThrow({ select: { id: true } });
  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: mark.id },
    select: { id: true },
  });
  const created = await prisma.request.create({
    data: {
      id: `test-request-${randomUUID()}`,
      number: `Т-${randomUUID()}`,
      studentId: profile.id,
      typeId: type.id,
      payload: {},
    },
    select: { id: true, number: true },
  });

  createdRequestIds.push(created.id);
  markRequestId = created.id;
  markRequestNumber = created.number;
});

afterAll(async () => {
  if (createdRequestIds.length > 0) {
    await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
  }

  await prisma.$disconnect();
});

function studentUser(student: Student): AiChatUser {
  return { id: student.id, role: "STUDENT" };
}

/** Тело запроса ровно в том виде, который принимает `chatRequestSchema`. */
function chatBody(text = "Что у меня сегодня по расписанию?"): string {
  return JSON.stringify({
    messages: [{ id: "msg-1", role: "user", parts: [{ type: "text", text }] }],
  });
}

function chatRequest(body: string = chatBody()): Request {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function toolCallChunks(toolName: string, input: unknown): LanguageModelV3StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: "call-1", toolName, input: JSON.stringify(input) },
    { type: "finish", usage: USAGE, finishReason: { unified: "tool-calls", raw: "tool-calls" } },
  ];
}

function textChunks(text: string): LanguageModelV3StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: text },
    { type: "text-end", id: "text-1" },
    { type: "finish", usage: USAGE, finishReason: { unified: "stop", raw: "stop" } },
  ];
}

/** Мок-модель с заранее заданной последовательностью шагов, без сети. */
function streamingModel(steps: LanguageModelV3StreamPart[][]): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doStream: steps.map((chunks) => ({ stream: simulateReadableStream({ chunks }) })),
  });
}

type Harness = {
  handler: (request: Request) => Promise<Response>;
  createModel: Mock<() => LanguageModel | null>;
  log: Mock<(event: string, fields: AiLogFields) => void>;
  limiter: ReturnType<typeof createAiRateLimiter>;
};

function createHarness(
  user: AiChatUser | null = studentUser(anna),
  overrides: Partial<AiChatDeps> = {},
): Harness {
  const createModel = vi.fn<() => LanguageModel | null>(() => null);
  const log = vi.fn<(event: string, fields: AiLogFields) => void>();
  const limiter = createAiRateLimiter();
  const deps: AiChatDeps = {
    getUser: async () => user,
    isEnabled: () => true,
    createModel,
    limiter,
    now: () => NOW,
    log,
    ...overrides,
  };

  return { handler: createAiChatHandler(deps), createModel, log, limiter };
}

async function readError(response: Response): Promise<PublicError> {
  return (await response.json()) as PublicError;
}

/** Один успешный вызов чата: два шага, инструмент и текстовый ответ. */
async function runSuccessfulChat(text: string): Promise<{
  response: Response;
  body: string;
  model: MockLanguageModelV3;
  log: Mock<(event: string, fields: AiLogFields) => void>;
}> {
  const model = streamingModel([
    toolCallChunks("getSchedule", { range: "today" }),
    textChunks(text),
  ]);
  const harness = createHarness(studentUser(anna), {
    createModel: () => model,
    isEnabled: () => true,
  });
  const response = await harness.handler(chatRequest());
  const body = await response.text();

  return { response, body, model, log: harness.log };
}

describe("доступ и деградация", () => {
  it("гостю отвечает 401 и не обращается к провайдеру", async () => {
    const { handler, createModel } = createHarness(null);

    const response = await handler(chatRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect((await readError(response)).error.code).toBe("UNAUTHORIZED");
    expect(createModel).not.toHaveBeenCalled();
  });

  it("сотруднику деканата отвечает 403", async () => {
    const { handler, createModel } = createHarness(
      { id: "employee-1", role: "DEAN_EMPLOYEE" },
      { isEnabled: () => true },
    );

    const response = await handler(chatRequest());

    expect(response.status).toBe(403);
    expect((await readError(response)).error.code).toBe("FORBIDDEN");
    expect(createModel).not.toHaveBeenCalled();
  });

  it("401 и 403 не читают тело запроса", async () => {
    const guest = createHarness(null);
    const guestResponse = await guest.handler(chatRequest("{"));

    expect(guestResponse.status).toBe(401);
    expect((await readError(guestResponse)).error.code).toBe("UNAUTHORIZED");

    const employee = createHarness({ id: "employee-1", role: "DEAN_EMPLOYEE" });
    const employeeResponse = await employee.handler(chatRequest("{"));

    expect(employeeResponse.status).toBe(403);
    expect((await readError(employeeResponse)).error.code).toBe("FORBIDDEN");
  });

  it("сбой конфигурации модели отвечает 503, логирует имя и не тратит квоту", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.fn<(event: string, fields: AiLogFields) => void>();
    const limiter = createAiRateLimiter();

    const broken = createAiChatHandler({
      getUser: async () => studentUser(anna),
      isEnabled: () => true,
      createModel: () => {
        throw new Error("provider config exploded");
      },
      limiter,
      now: () => NOW,
      log,
    });

    const response = await broken(chatRequest());

    expect(response.status).toBe(503);
    expect((await readError(response)).error.code).toBe("AI_UNAVAILABLE");

    const event = log.mock.calls.find(([name]) => name === "chat.model_failed");
    expect(event).toBeDefined();
    expect((event?.[1] as AiLogFields).errorName).toBe("Error");
    expect(JSON.stringify(log.mock.calls)).not.toContain("provider config exploded");

    // Квота не израсходована: с рабочей моделью тот же лимитер пропускает запрос.
    const model = streamingModel([textChunks("Здравствуйте!")]);
    const healthy = createAiChatHandler({
      getUser: async () => studentUser(anna),
      isEnabled: () => true,
      createModel: () => model,
      limiter,
      now: () => NOW,
      log: () => undefined,
    });
    const healthyResponse = await healthy(chatRequest());

    expect(healthyResponse.status).toBe(200);
    await healthyResponse.text();

    consoleError.mockRestore();
  });

  it("при выключенном флаге отвечает 503 до чтения тела", async () => {
    const { handler, createModel } = createHarness(studentUser(anna), { isEnabled: () => false });

    const valid = await handler(chatRequest());
    expect(valid.status).toBe(503);
    expect((await readError(valid)).error.code).toBe("AI_UNAVAILABLE");

    // Даже сломанное тело не разбирается: флаг проверяется раньше.
    const broken = await handler(chatRequest("{"));
    expect(broken.status).toBe(503);
    expect((await readError(broken)).error.code).toBe("AI_UNAVAILABLE");

    expect(createModel).not.toHaveBeenCalled();
  });

  it("без ключа провайдера отвечает 503", async () => {
    const { handler } = createHarness(studentUser(anna), { createModel: () => null });

    const response = await handler(chatRequest());

    expect(response.status).toBe(503);
    expect((await readError(response)).error.code).toBe("AI_UNAVAILABLE");
  });

  it("превращает сбой проверки сессии в 401 или 500 без деталей", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const unauthorized = createHarness(studentUser(anna), {
      getUser: async () => {
        throw new AppError("UNAUTHORIZED");
      },
    });
    const unauthorizedResponse = await unauthorized.handler(chatRequest());
    expect(unauthorizedResponse.status).toBe(401);
    expect((await readError(unauthorizedResponse)).error.code).toBe("UNAUTHORIZED");

    const broken = createHarness(studentUser(anna), {
      getUser: async () => {
        throw new Error("session store exploded");
      },
    });
    const brokenResponse = await broken.handler(chatRequest());
    const brokenBody = (await brokenResponse.json()) as PublicError;

    expect(brokenResponse.status).toBe(500);
    expect(brokenBody.error.code).toBe("INTERNAL");
    expect(brokenBody.error.requestId).toBeTruthy();
    expect(brokenResponse.headers.get("x-request-id")).toBeTruthy();
    expect(JSON.stringify(brokenBody)).not.toContain("session store exploded");

    consoleError.mockRestore();
  });
});

describe("валидация тела", () => {
  it.each([
    ["невалидный JSON", "{"],
    ["пустую историю", JSON.stringify({ messages: [] })],
    [
      "21 сообщение",
      JSON.stringify({
        messages: Array.from({ length: 21 }, (_, index) => ({
          id: `msg-${index}`,
          role: "user",
          parts: [{ type: "text", text: "Вопрос" }],
        })),
      }),
    ],
    [
      "файловую часть",
      JSON.stringify({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "file", mediaType: "image/png", url: "data:image/png;base64,AA==" }],
          },
        ],
      }),
    ],
  ])("отклоняет %s с кодом 422", async (_label, body) => {
    const { handler, createModel } = createHarness(studentUser(anna), { isEnabled: () => true });

    const response = await handler(chatRequest(body));

    expect(response.status).toBe(422);
    expect((await readError(response)).error.code).toBe("VALIDATION");
    expect(createModel).not.toHaveBeenCalled();
  });

  it("отклоняет тело больше AI_MAX_BODY_BYTES до разбора JSON", async () => {
    const { handler, createModel } = createHarness(studentUser(anna), { isEnabled: () => true });
    // Валидный JSON с хвостовыми пробелами: без проверки размера он прошёл бы
    // схему, поэтому ответ 422 доказывает именно байтовый лимит.
    const padded = `${chatBody()}${" ".repeat(AI_MAX_BODY_BYTES)}`;
    const request = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(AI_MAX_BODY_BYTES + 1),
      },
      body: padded,
    });

    const response = await handler(request);

    expect(response.status).toBe(422);
    expect((await readError(response)).error.code).toBe("VALIDATION");
    expect(createModel).not.toHaveBeenCalled();
  });
});

describe("лимиты запросов", () => {
  it("21-й запрос за 10 минут получает 429, другой студент проходит", async () => {
    // Лимит проверяется после конфигурации модели, поэтому ей нужен валидный
    // результат: иначе обработчик ответил бы 503, не дойдя до лимитера.
    const model = streamingModel([textChunks("Здравствуйте!")]);
    const { handler, limiter } = createHarness(studentUser(anna), {
      createModel: () => model,
    });

    for (let index = 0; index < AI_RATE_LIMIT_PER_WINDOW; index += 1) {
      expect(limiter.tryConsume(anna.id, NOW)).toBe(true);
    }

    const limited = await handler(chatRequest());

    expect(limited.status).toBe(429);
    expect((await readError(limited)).error.code).toBe("RATE_LIMITED");
    expect(model.doStreamCalls).toHaveLength(0);

    const markHandler = createAiChatHandler({
      getUser: async () => studentUser(mark),
      isEnabled: () => true,
      createModel: () => model,
      limiter,
      now: () => NOW,
      log: () => undefined,
    });

    const allowed = await markHandler(chatRequest());

    expect(allowed.status).toBe(200);
    await allowed.text();
  });
});

describe("стриминг", () => {
  const ANSWER = "Сегодня у вас две пары по дискретной математике.";

  it("отдаёт UI-message stream по шагам инструментов", async () => {
    const { response, body, model, log } = await runSuccessfulChat(ANSWER);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain(ANSWER);
    // Первый шаг — вызов инструмента, второй — текстовый ответ.
    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls[0]?.maxOutputTokens).toBe(800);

    const toolNames = model.doStreamCalls[0]?.tools?.map((tool) => tool.name) ?? [];

    expect(toolNames).toHaveLength(5);
    expect(toolNames).toEqual([
      "getSchedule",
      "getGrades",
      "getRequests",
      "getNotifications",
      "getUpcoming",
    ]);

    const systemMessage = model.doStreamCalls[0]?.prompt.find(
      (message) => message.role === "system",
    );

    expect(systemMessage?.role).toBe("system");

    if (systemMessage?.role !== "system") {
      throw new Error("Системная инструкция не передана модели.");
    }

    expect(systemMessage.content).toContain("ISO 8601");
    expect(systemMessage.content).toContain("UTC+3");

    // Логи содержат только метрики: текст инструкции туда не попадает.
    expect(JSON.stringify(log.mock.calls)).not.toContain("Ты — помощник");
    expect(JSON.stringify(log.mock.calls)).not.toContain("ISO 8601");
  });

  it("не изменяет данные кабинета за один ответ", async () => {
    const [requestsBefore, notificationsBefore, gradesBefore] = await Promise.all([
      prisma.request.count(),
      prisma.notification.count(),
      prisma.grade.count(),
    ]);

    // Хелпер уже вычитал стрим: инструменты выполнились до конца.
    await runSuccessfulChat(ANSWER);

    const [requestsAfter, notificationsAfter, gradesAfter] = await Promise.all([
      prisma.request.count(),
      prisma.notification.count(),
      prisma.grade.count(),
    ]);

    expect({
      requests: requestsAfter,
      notifications: notificationsAfter,
      grades: gradesAfter,
    }).toEqual({
      requests: requestsBefore,
      notifications: notificationsBefore,
      grades: gradesBefore,
    });
  });

  it("прячет ошибку провайдера за нейтральным текстом и логирует её", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const model = new MockLanguageModelV3({
      doStream: async () => {
        throw new Error("upstream-provider-secret-body");
      },
    });
    const log = vi.fn<(event: string, fields: AiLogFields) => void>();
    const handler = createAiChatHandler({
      getUser: async () => studentUser(anna),
      isEnabled: () => true,
      createModel: () => model,
      limiter: createAiRateLimiter(),
      now: () => NOW,
      log,
    });

    const response = await handler(chatRequest());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Помощник временно недоступен. Остальные разделы работают.");
    expect(body).not.toContain("upstream-provider-secret-body");

    const errorEvent = log.mock.calls.find(([event]) => event === "chat.stream_failed");
    expect(errorEvent).toBeDefined();

    const fields = errorEvent?.[1] as AiLogFields;
    expect(fields.errorName).toBe("Error");
    for (const key of Object.keys(fields)) {
      expect(LOG_FIELDS.has(key as keyof AiLogFields)).toBe(true);
    }

    consoleError.mockRestore();
  });
});

describe("изоляция данных", () => {
  it("чужой requestId не раскрывает заявку другого студента", async () => {
    const tools = createAiTools(anna.id, NOW);
    const execute = tools.getRequests?.execute;

    expect(execute).toBeDefined();

    const requestsBefore = await prisma.request.count();
    const answer = (await execute!(
      { requestId: markRequestId },
      { toolCallId: "t", messages: [] },
    )) as RequestsAnswer;

    expect(answer.detail).toBeNull();
    expect(answer.items).toEqual([]);

    const serialized = JSON.stringify(answer);
    expect(serialized).not.toContain(markRequestNumber);
    expect(serialized).not.toContain(mark.name);

    expect(await prisma.request.count()).toBe(requestsBefore);
  });

  it("оценки и уведомления Марка не содержат данных Анны", async () => {
    const annaProfile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: anna.id },
      select: { id: true, studentNumber: true },
    });

    // У Анны есть адресные уведомления (`audienceType = STUDENT`): их
    // идентификатор аудитории не должен попадать в ответ другому студенту.
    const annaAudienceIds = [
      ...new Set(
        (
          await prisma.notification.findMany({
            where: { audienceStudentId: annaProfile.id },
            select: { audienceStudentId: true },
          })
        )
          .map((notification) => notification.audienceStudentId)
          .filter((id): id is string => id !== null),
      ),
    ];

    const tools = createAiTools(mark.id, NOW);
    const gradesExecute = tools.getGrades?.execute;
    const notificationsExecute = tools.getNotifications?.execute;

    expect(gradesExecute).toBeDefined();
    expect(notificationsExecute).toBeDefined();

    const [grades, notifications] = await Promise.all([
      gradesExecute!({}, { toolCallId: "grades", messages: [] }) as Promise<GradesAnswer>,
      notificationsExecute!(
        {},
        { toolCallId: "notifications", messages: [] },
      ) as Promise<NotificationsAnswer>,
    ]);

    const serialized = JSON.stringify({ grades, notifications });

    expect(serialized).not.toContain(annaProfile.studentNumber);
    expect(serialized).not.toContain(ANNA_EMAIL);

    // Если изменённый seed не содержит адресных уведомлений Анны, проверять
    // нечего: идентификаторы не выдумываются.
    for (const audienceId of annaAudienceIds) {
      expect(serialized).not.toContain(audienceId);
    }
  });

  it("ближайшие дедлайны не содержат данных Марка", async () => {
    const tools = createAiTools(anna.id, NOW);
    const execute = tools.getUpcoming?.execute;

    expect(execute).toBeDefined();

    const answer = (await execute!(
      { days: 30 },
      { toolCallId: "upcoming", messages: [] },
    )) as UpcomingAnswer;

    expect(answer.available).toBe(true);
    expect(answer.horizonDays).toBe(30);

    const serialized = JSON.stringify(answer);
    expect(serialized).not.toContain(markRequestNumber);
    expect(serialized).not.toContain(mark.name);
    expect(serialized).not.toContain(ANNA_EMAIL);
  });
});
