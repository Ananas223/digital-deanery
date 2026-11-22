import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db/client";
import { getCertificateForOwner, getCertificateVerification } from "@/lib/domain/certificates";
import { createRequestForUser, transitionRequestStatusForActor } from "@/lib/domain/requests";
import type { CreateRequestInput } from "@/lib/validation/requests";

const prisma = createPrismaClient();

const NOW = new Date("2026-11-18T09:00:00.000Z");

type Fixture = {
  annaId: string;
  markId: string;
  employeeId: string;
  seededCertificateId: string;
};

let fixture: Fixture;

const createdRequestIds: string[] = [];

/** Каждое создание сдвигает часы, чтобы не упираться в лимит 10 за 10 минут. */
let creationOffset = 0;

function nextCreationTime(): Date {
  creationOffset += 1;
  return new Date(NOW.getTime() + creationOffset * 11 * 60 * 1000);
}

function later(created: { createdAt: Date }, minutes = 1): Date {
  return new Date(created.createdAt.getTime() + minutes * 60 * 1000);
}

function track(id: string): string {
  createdRequestIds.push(id);
  return id;
}

function studyInput(clientRequestId: string = randomUUID()): CreateRequestInput {
  return {
    typeCode: "STUDY_CERTIFICATE",
    clientRequestId,
    payload: { deliveryPlace: "Деканат факультета информатики" },
  };
}

async function findUserId(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (!user) {
    throw new Error(`Демо-пользователь ${email} не найден; проверьте seed.`);
  }

  return user.id;
}

beforeAll(async () => {
  const [annaId, markId, employeeId] = await Promise.all([
    findUserId("anna.petrova@example.com"),
    findUserId("mark.sokolov@example.com"),
    findUserId("elena.smirnova@example.com"),
  ]);

  const seeded = await prisma.request.findUnique({
    where: { verifyCode: "annaCertDemo0001" },
    select: { id: true },
  });

  if (!seeded) {
    throw new Error("Seed не создал готовую демо-справку с кодом annaCertDemo0001.");
  }

  fixture = { annaId, markId, employeeId, seededCertificateId: seeded.id };
});

afterAll(async () => {
  if (createdRequestIds.length > 0) {
    await prisma.notification.deleteMany({ where: { targetId: { in: createdRequestIds } } });
    await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
  }

  await prisma.$disconnect();
});

describe("бланк справки владельцу", () => {
  it("отдаёт владельцу полную проекцию готовой справки", async () => {
    const certificate = await getCertificateForOwner(fixture.annaId, fixture.seededCertificateId);

    expect(certificate).not.toBeNull();
    expect(certificate).toMatchObject({
      typeCode: "STUDY_CERTIFICATE",
      typeTitle: "Справка об обучении",
      fullName: "Анна Петрова",
      facultyName: "Факультет международных отношений",
      programName: "Международные отношения",
      course: 2,
      groupCode: "MO-21-4",
      verifyCode: "annaCertDemo0001",
    });
    expect(certificate?.number).toMatch(/^З-\d{4}-900001$/);
    expect(certificate?.readyAt).toBeInstanceOf(Date);
  });

  it("не отдаёт бланк другому студенту и сотруднику", async () => {
    await expect(
      getCertificateForOwner(fixture.markId, fixture.seededCertificateId),
    ).resolves.toBeNull();
    await expect(
      getCertificateForOwner(fixture.employeeId, fixture.seededCertificateId),
    ).resolves.toBeNull();
  });

  it("не отдаёт бланк до статуса READY и отдаёт после", async () => {
    const created = await createRequestForUser(fixture.annaId, studyInput(), nextCreationTime());
    track(created.id);

    const stored = await prisma.request.findUniqueOrThrow({
      where: { id: created.id },
      select: { verifyCode: true },
    });

    expect(stored.verifyCode).toMatch(/^[A-Za-z0-9_-]{16}$/);
    await expect(getCertificateForOwner(fixture.annaId, created.id)).resolves.toBeNull();
    await expect(getCertificateVerification(stored.verifyCode ?? "")).resolves.toBeNull();

    const employee = { userId: fixture.employeeId, role: "DEAN_EMPLOYEE" as const };
    await transitionRequestStatusForActor(
      employee,
      { requestId: created.id, toStatus: "IN_PROGRESS" },
      later(created),
    );
    await transitionRequestStatusForActor(
      employee,
      { requestId: created.id, toStatus: "READY" },
      later(created, 2),
    );

    const certificate = await getCertificateForOwner(fixture.annaId, created.id);
    expect(certificate?.verifyCode).toBe(stored.verifyCode);
    expect(certificate?.number).toBe(created.number);
  });

  it("не отдаёт бланк по не-справочному типу", async () => {
    const created = await createRequestForUser(
      fixture.annaId,
      {
        typeCode: "ACADEMIC_LEAVE",
        clientRequestId: randomUUID(),
        payload: {
          reason: "Медицинские показания, подтверждённые справкой клиники",
          startDate: "2027-02-01",
          endDate: "2027-06-30",
        },
      },
      nextCreationTime(),
    );
    track(created.id);

    const stored = await prisma.request.findUniqueOrThrow({
      where: { id: created.id },
      select: { verifyCode: true },
    });

    // Код проверки выдаётся только справкам.
    expect(stored.verifyCode).toBeNull();

    // Даже если код появился, не-справочный тип не проверяется.
    const forcedCode = `forced${randomUUID().slice(0, 8)}`;
    await prisma.request.update({
      where: { id: created.id },
      data: { verifyCode: forcedCode, status: "READY" },
    });

    await expect(getCertificateForOwner(fixture.annaId, created.id)).resolves.toBeNull();
    await expect(getCertificateVerification(forcedCode)).resolves.toBeNull();
  });

  it("выдаёт код и справке по месту требования", async () => {
    const created = await createRequestForUser(
      fixture.annaId,
      {
        typeCode: "PLACE_REQUIREMENT",
        clientRequestId: randomUUID(),
        payload: {
          organizationName: "ООО «Северный ветер»",
          deliveryPlace: "Отдел кадров, кабинет 210",
        },
      },
      nextCreationTime(),
    );
    track(created.id);

    const stored = await prisma.request.findUniqueOrThrow({
      where: { id: created.id },
      select: { verifyCode: true },
    });

    expect(stored.verifyCode).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });
});

describe("публичная проверка справки", () => {
  it("отдаёт только разрешённый минимум полей", async () => {
    const verification = await getCertificateVerification("annaCertDemo0001");

    expect(verification).toEqual({
      fullName: "Анна Петрова",
      facultyName: "Факультет международных отношений",
      programName: "Международные отношения",
      course: 2,
      groupCode: "MO-21-4",
      readyAt: expect.any(Date),
      status: "READY",
    });
    expect(Object.keys(verification ?? {})).toHaveLength(7);
    expect(verification).not.toHaveProperty("number");
    expect(verification).not.toHaveProperty("id");
    expect(verification).not.toHaveProperty("studentNumber");
    expect(verification).not.toHaveProperty("email");

    const serialized = JSON.stringify(verification);
    expect(serialized).not.toContain("900001");
    expect(serialized).not.toContain("MO-21-0047");
    expect(serialized).not.toContain("anna.petrova@example.com");
  });

  it("возвращает null на неизвестный код", async () => {
    await expect(getCertificateVerification("unknown-code")).resolves.toBeNull();
    await expect(getCertificateVerification("")).resolves.toBeNull();
  });
});
