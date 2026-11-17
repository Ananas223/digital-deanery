import { describe, expect, it } from "vitest";

import {
  cancelRequestSchema,
  createRequestSchema,
  requestListQuerySchema,
  requestPayloadSchema,
  requestStatusTransitionSchema,
  requestTypeCodeSchema,
} from "@/lib/validation/requests";

const CLIENT_REQUEST_ID = "3f6f2a0e-8d4b-4a1c-9f7e-2c5d6b8a1f30";

const studyCertificate = {
  typeCode: "STUDY_CERTIFICATE",
  payload: { deliveryPlace: "Деканат факультета информатики" },
};

const placeRequirement = {
  typeCode: "PLACE_REQUIREMENT",
  payload: {
    organizationName: "ООО «Пример»",
    deliveryPlace: "Отдел кадров, кабинет 210",
  },
};

const academicLeave = {
  typeCode: "ACADEMIC_LEAVE",
  payload: {
    reason: "Медицинские показания, подтверждённые справкой",
    startDate: "2027-02-01",
    endDate: "2027-06-30",
  },
};

const retake = {
  typeCode: "RETAKE",
  payload: {
    disciplineId: "cm5z8x2q10000abcd1234efgh",
    reason: "Не сдал экзамен по уважительной причине",
  },
};

describe("requestTypeCodeSchema", () => {
  it.each(["STUDY_CERTIFICATE", "PLACE_REQUIREMENT", "ACADEMIC_LEAVE", "RETAKE"])(
    "принимает код %s",
    (code) => {
      expect(requestTypeCodeSchema.parse(code)).toBe(code);
    },
  );

  it("отклоняет неизвестный тип", () => {
    expect(requestTypeCodeSchema.safeParse("UNKNOWN").success).toBe(false);
  });
});

describe("requestPayloadSchema", () => {
  it.each([studyCertificate, placeRequirement, academicLeave, retake])(
    "принимает корректные поля типа $typeCode",
    (value) => {
      expect(requestPayloadSchema.safeParse(value).success).toBe(true);
    },
  );

  it("обрезает пробелы по краям строк", () => {
    const parsed = requestPayloadSchema.parse({
      ...studyCertificate,
      payload: { deliveryPlace: "  Деканат факультета информатики  " },
    });

    expect(parsed.typeCode).toBe("STUDY_CERTIFICATE");
    if (parsed.typeCode !== "STUDY_CERTIFICATE") {
      throw new Error("Ожидался тип STUDY_CERTIFICATE");
    }
    expect(parsed.payload.deliveryPlace).toBe("Деканат факультета информатики");
  });

  it("превращает пустой комментарий в отсутствующее поле", () => {
    const parsed = requestPayloadSchema.parse({
      ...studyCertificate,
      payload: { deliveryPlace: "Деканат факультета информатики", comment: "   " },
    });

    expect(parsed.typeCode).toBe("STUDY_CERTIFICATE");
    if (parsed.typeCode !== "STUDY_CERTIFICATE") {
      throw new Error("Ожидался тип STUDY_CERTIFICATE");
    }
    expect(parsed.payload.comment).toBeUndefined();
  });

  it("ограничивает длину места предоставления", () => {
    expect(
      requestPayloadSchema.safeParse({
        typeCode: "STUDY_CERTIFICATE",
        payload: { deliveryPlace: "Дом" },
      }).success,
    ).toBe(false);

    expect(
      requestPayloadSchema.safeParse({
        typeCode: "STUDY_CERTIFICATE",
        payload: { deliveryPlace: "я".repeat(201) },
      }).success,
    ).toBe(false);
  });

  it("ограничивает комментарий 500 символами", () => {
    expect(
      requestPayloadSchema.safeParse({
        ...studyCertificate,
        payload: { ...studyCertificate.payload, comment: "я".repeat(501) },
      }).success,
    ).toBe(false);
  });

  it("требует причину академического отпуска не короче 10 символов", () => {
    expect(
      requestPayloadSchema.safeParse({
        typeCode: "ACADEMIC_LEAVE",
        payload: { reason: "болел", startDate: "2027-02-01", endDate: "2027-06-30" },
      }).success,
    ).toBe(false);
  });

  it("не принимает дату окончания раньше даты начала", () => {
    const result = requestPayloadSchema.safeParse({
      typeCode: "ACADEMIC_LEAVE",
      payload: {
        reason: "Медицинские показания, подтверждённые справкой",
        startDate: "2027-06-30",
        endDate: "2027-02-01",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("endDate"))).toBe(true);
    }
  });

  it("разрешает одинаковые даты начала и окончания", () => {
    expect(
      requestPayloadSchema.safeParse({
        typeCode: "ACADEMIC_LEAVE",
        payload: {
          reason: "Медицинские показания, подтверждённые справкой",
          startDate: "2027-02-01",
          endDate: "2027-02-01",
        },
      }).success,
    ).toBe(true);
  });

  it("отклоняет несуществующую календарную дату", () => {
    expect(
      requestPayloadSchema.safeParse({
        typeCode: "ACADEMIC_LEAVE",
        payload: {
          reason: "Медицинские показания, подтверждённые справкой",
          startDate: "2027-02-30",
          endDate: "2027-06-30",
        },
      }).success,
    ).toBe(false);
  });

  it("требует cuid дисциплины для пересдачи", () => {
    expect(
      requestPayloadSchema.safeParse({
        typeCode: "RETAKE",
        payload: { disciplineId: "not-a-cuid", reason: "Не сдал экзамен по уважительной причине" },
      }).success,
    ).toBe(false);
  });

  it("не принимает поля другого типа", () => {
    expect(
      requestPayloadSchema.safeParse({
        typeCode: "RETAKE",
        payload: { deliveryPlace: "Деканат факультета информатики" },
      }).success,
    ).toBe(false);
  });
});

describe("createRequestSchema", () => {
  it("добавляет clientRequestId к полям типа", () => {
    const parsed = createRequestSchema.parse({
      ...studyCertificate,
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(parsed.clientRequestId).toBe(CLIENT_REQUEST_ID);
  });

  it("требует корректный uuid идемпотентного ключа", () => {
    expect(
      createRequestSchema.safeParse({ ...studyCertificate, clientRequestId: "repeat" }).success,
    ).toBe(false);
  });

  it("не принимает студента, номер и статус из клиента", () => {
    const parsed = createRequestSchema.parse({
      ...studyCertificate,
      clientRequestId: CLIENT_REQUEST_ID,
      studentId: "foreign",
      number: "З-2026-000001",
      status: "READY",
    });

    expect(parsed).not.toHaveProperty("studentId");
    expect(parsed).not.toHaveProperty("number");
    expect(parsed).not.toHaveProperty("status");
  });
});

describe("requestListQuerySchema", () => {
  it("принимает пустой фильтр и известный статус", () => {
    expect(requestListQuerySchema.parse({})).toEqual({});
    expect(requestListQuerySchema.parse({ status: "IN_PROGRESS" })).toEqual({
      status: "IN_PROGRESS",
    });
  });

  it("отклоняет неизвестный статус", () => {
    expect(requestListQuerySchema.safeParse({ status: "DONE" }).success).toBe(false);
  });
});

describe("cancelRequestSchema", () => {
  it("требует cuid заявки", () => {
    expect(cancelRequestSchema.safeParse({ requestId: "abc" }).success).toBe(false);
    expect(
      cancelRequestSchema.safeParse({ requestId: "cm5z8x2q10000abcd1234efgh" }).success,
    ).toBe(true);
  });
});

describe("requestStatusTransitionSchema", () => {
  const requestId = "cm5z8x2q10000abcd1234efgh";

  it("принимает переход в работу", () => {
    expect(
      requestStatusTransitionSchema.parse({ requestId, toStatus: "IN_PROGRESS" }),
    ).toEqual({ requestId, toStatus: "IN_PROGRESS" });
  });

  it("требует причину при отклонении", () => {
    expect(
      requestStatusTransitionSchema.safeParse({ requestId, toStatus: "REJECTED" }).success,
    ).toBe(false);
    expect(
      requestStatusTransitionSchema.safeParse({
        requestId,
        toStatus: "REJECTED",
        comment: "   ",
      }).success,
    ).toBe(false);
  });

  it("принимает отклонение с причиной", () => {
    expect(
      requestStatusTransitionSchema.safeParse({
        requestId,
        toStatus: "REJECTED",
        comment: "Не приложены документы",
      }).success,
    ).toBe(true);
  });

  it("не принимает неизвестный статус", () => {
    expect(
      requestStatusTransitionSchema.safeParse({ requestId, toStatus: "DONE" }).success,
    ).toBe(false);
  });
});
