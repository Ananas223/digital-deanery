import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

/** Типы заявок, по которым выпускается печатная справка и код проверки. */
export const CERTIFICATE_TYPE_CODES = ["STUDY_CERTIFICATE", "PLACE_REQUIREMENT"] as const;

export type CertificateTypeCode = (typeof CERTIFICATE_TYPE_CODES)[number];

export function isCertificateType(code: string): code is CertificateTypeCode {
  return (CERTIFICATE_TYPE_CODES as readonly string[]).includes(code);
}

/** 12 случайных байт дают 16 символов base64url — 96 бит энтропии. */
export const VERIFY_CODE_BYTES = 12;

/**
 * Код проверки справки: 16 символов base64url, не выводится из `id` или номера
 * заявки. Уникальность обеспечивает индекс `Request.verifyCode`.
 */
export function generateVerifyCode(): string {
  return randomBytes(VERIFY_CODE_BYTES).toString("base64url");
}

/**
 * Публичная ссылка проверки. Заголовок `Host` не используется: адрес приложения
 * берётся только из окружения, чтобы QR нельзя было подменить запросом.
 */
export function buildVerificationUrl(code: string): string {
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"]?.trim();

  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL не задан: невозможно построить ссылку проверки справки. Укажите публичный адрес приложения в переменных окружения.",
    );
  }

  return `${appUrl.replace(/\/+$/, "")}/verify/${code}`;
}

/** Бланк владельца: данные справки и код для QR. */
export type CertificateForOwner = {
  number: string;
  typeCode: CertificateTypeCode;
  typeTitle: string;
  fullName: string;
  facultyName: string;
  programName: string;
  course: number;
  groupCode: string;
  readyAt: Date;
  verifyCode: string;
};

/** Публичная проверка: минимум полей, без номера и идентификатора заявки. */
export type CertificateVerification = {
  fullName: string;
  facultyName: string;
  programName: string;
  course: number;
  groupCode: string;
  readyAt: Date;
  status: "READY";
};

const certificateStudentSelect = {
  course: true,
  user: { select: { name: true } },
  group: { select: { code: true } },
  faculty: { select: { name: true } },
  program: { select: { name: true } },
} as const;

const readyHistorySelect = {
  where: { toStatus: "READY" as const },
  orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  take: 1,
  select: { createdAt: true },
};

/**
 * Бланк доступен только владельцу, только готовой заявке и только типу справки.
 * Чужой идентификатор, другой статус и другой тип одинаково дают `null`.
 */
export async function getCertificateForOwner(
  userId: string,
  requestId: string,
): Promise<CertificateForOwner | null> {
  const request = await prisma.request.findFirst({
    where: {
      id: requestId,
      status: "READY",
      verifyCode: { not: null },
      student: { userId },
      type: { code: { in: [...CERTIFICATE_TYPE_CODES] } },
    },
    select: {
      number: true,
      verifyCode: true,
      updatedAt: true,
      type: { select: { code: true, title: true } },
      student: { select: certificateStudentSelect },
      history: readyHistorySelect,
    },
  });

  if (!request?.verifyCode || !isCertificateType(request.type.code)) {
    return null;
  }

  return {
    number: request.number,
    typeCode: request.type.code,
    typeTitle: request.type.title,
    fullName: request.student.user.name,
    facultyName: request.student.faculty.name,
    programName: request.student.program.name,
    course: request.student.course,
    groupCode: request.student.group.code,
    readyAt: request.history[0]?.createdAt ?? request.updatedAt,
    verifyCode: request.verifyCode,
  };
}

/**
 * Публичная проверка по коду. Возвращает только разрешённый минимум полей:
 * номер заявки, `id`, номер студенческого, e-mail, payload и историю не отдаём.
 * Неизвестный код, не-`READY` и не-справочный тип одинаково дают `null`.
 */
export async function getCertificateVerification(
  code: string,
): Promise<CertificateVerification | null> {
  const request = await prisma.request.findFirst({
    where: {
      verifyCode: code,
      status: "READY",
      type: { code: { in: [...CERTIFICATE_TYPE_CODES] } },
    },
    select: {
      updatedAt: true,
      type: { select: { code: true } },
      student: { select: certificateStudentSelect },
      history: readyHistorySelect,
    },
  });

  if (!request || !isCertificateType(request.type.code)) {
    return null;
  }

  return {
    fullName: request.student.user.name,
    facultyName: request.student.faculty.name,
    programName: request.student.program.name,
    course: request.student.course,
    groupCode: request.student.group.code,
    readyAt: request.history[0]?.createdAt ?? request.updatedAt,
    status: "READY",
  };
}
