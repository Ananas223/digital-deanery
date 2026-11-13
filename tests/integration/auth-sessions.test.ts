import { toNextJsHandler } from "better-auth/next-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

const BASE_URL = "http://localhost:3000";
const DEMO_PASSWORD = "Deanery#2026";

const ANNA = { email: "anna.petrova@example.com", name: "Анна Петрова" } as const;
const MARK = { email: "mark.sokolov@example.com", name: "Марк Соколов" } as const;

const handler = toNextJsHandler(auth);

type SessionPayload = {
  user?: {
    email?: string;
    name?: string;
  };
};

type SignInPayload = {
  user?: {
    email?: string;
  };
};

async function signIn(email: string, password: string): Promise<Response> {
  return handler.POST(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password }),
    }),
  );
}

/** Склеивает Set-Cookie в заголовок Cookie для следующего запроса. */
function toCookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function getSession(cookie: string): Promise<{ response: Response; body: SessionPayload }> {
  const response = await handler.GET(
    new Request(`${BASE_URL}/api/auth/get-session`, {
      method: "GET",
      headers: { cookie },
    }),
  );

  return { response, body: (await response.json()) as SessionPayload };
}

let annaCookie = "";
let markCookie = "";

beforeAll(async () => {
  // Каждый прогон начинается без сессий предыдущих прогонов.
  await prisma.session.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("сессии Better Auth через Route Handler", () => {
  it("Анна и Марк входят с демонстрационным паролем и получают разные cookie", async () => {
    const annaResponse = await signIn(ANNA.email, DEMO_PASSWORD);
    const markResponse = await signIn(MARK.email, DEMO_PASSWORD);

    expect(annaResponse.status).toBe(200);
    expect(markResponse.status).toBe(200);

    const annaBody = (await annaResponse.json()) as SignInPayload;
    const markBody = (await markResponse.json()) as SignInPayload;

    expect(annaBody.user?.email).toBe(ANNA.email);
    expect(markBody.user?.email).toBe(MARK.email);

    annaCookie = toCookieHeader(annaResponse);
    markCookie = toCookieHeader(markResponse);

    expect(annaCookie).toBeTruthy();
    expect(markCookie).toBeTruthy();
    expect(annaCookie).not.toBe(markCookie);
  });

  it("каждая cookie возвращает сессию своего студента", async () => {
    const anna = await getSession(annaCookie);
    const mark = await getSession(markCookie);

    expect(anna.response.status).toBe(200);
    expect(mark.response.status).toBe(200);
    expect(anna.body.user?.email).toBe(ANNA.email);
    expect(anna.body.user?.name).toBe(ANNA.name);
    expect(mark.body.user?.email).toBe(MARK.email);
    expect(mark.body.user?.name).toBe(MARK.name);
  });

  it("cookie Анны не даёт сессию Марка", async () => {
    const anna = await getSession(annaCookie);

    expect(anna.body.user?.email).not.toBe(MARK.email);
  });

  it("неверный пароль отклоняется с нейтральным 401", async () => {
    const response = await signIn(ANNA.email, "WrongPassword#1");
    const payload = (await response.json()) as { user?: unknown };

    expect(response.status).toBe(401);
    expect(payload.user).toBeUndefined();
    expect(toCookieHeader(response)).toBe("");
  });

  it("активные сессии сохранены в БД и привязаны к разным пользователям", async () => {
    const sessions = await prisma.session.findMany({
      select: { userId: true, user: { select: { email: true } } },
    });

    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.user.email).sort()).toEqual([ANNA.email, MARK.email]);
  });
});
