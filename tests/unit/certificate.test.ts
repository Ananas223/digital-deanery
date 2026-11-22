import { afterEach, describe, expect, it } from "vitest";

import {
  buildVerificationUrl,
  CERTIFICATE_TYPE_CODES,
  generateVerifyCode,
  isCertificateType,
  VERIFY_CODE_BYTES,
} from "@/lib/domain/certificates";

const ORIGINAL_APP_URL = process.env["NEXT_PUBLIC_APP_URL"];

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) {
    delete process.env["NEXT_PUBLIC_APP_URL"];
  } else {
    process.env["NEXT_PUBLIC_APP_URL"] = ORIGINAL_APP_URL;
  }
});

describe("код проверки справки", () => {
  it("выдаёт 16 символов base64url из 12 случайных байт", () => {
    expect(VERIFY_CODE_BYTES).toBe(12);

    const code = generateVerifyCode();

    expect(code).toHaveLength(16);
    expect(code).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it("не повторяется на большой выборке", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateVerifyCode()));

    expect(codes.size).toBe(2000);
  });

  it("не связан с номером заявки и не выводится из него", () => {
    const number = "З-2026-900001";
    expect(number).toMatch(/^З-\d{4}-\d{6}$/);

    const codes = new Set(Array.from({ length: 50 }, () => generateVerifyCode()));

    for (const code of codes) {
      expect(code).not.toBe(number);
      expect(code.startsWith("З-")).toBe(false);
      expect(code).not.toBe("900001");
    }

    // Код не повторяется при одном и том же номере: связи «номер → код» нет.
    expect(codes.size).toBe(50);
  });

  it("распознаёт только типы справок", () => {
    expect(CERTIFICATE_TYPE_CODES).toEqual(["STUDY_CERTIFICATE", "PLACE_REQUIREMENT"]);
    expect(isCertificateType("STUDY_CERTIFICATE")).toBe(true);
    expect(isCertificateType("PLACE_REQUIREMENT")).toBe(true);
    expect(isCertificateType("ACADEMIC_LEAVE")).toBe(false);
    expect(isCertificateType("RETAKE")).toBe(false);
    expect(isCertificateType("")).toBe(false);
  });
});

describe("ссылка проверки справки", () => {
  it("собирает адрес из окружения и обрезает завершающий слэш", () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "https://deanery.example/";

    expect(buildVerificationUrl("abc123")).toBe("https://deanery.example/verify/abc123");
  });

  it("не добавляет второй слэш перед /verify", () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "http://localhost:3000///";

    expect(buildVerificationUrl("annaCertDemo0001")).toBe(
      "http://localhost:3000/verify/annaCertDemo0001",
    );
  });

  it("падает с понятной ошибкой без NEXT_PUBLIC_APP_URL", () => {
    delete process.env["NEXT_PUBLIC_APP_URL"];

    expect(() => buildVerificationUrl("abc123")).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
