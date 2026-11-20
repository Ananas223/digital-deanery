import { z } from "zod";

/**
 * Контракт заявок: один набор Zod-схем для формы и сервера.
 *
 * Тип заявки лежит на верхнем уровне и не дублируется внутри `payload`.
 * Сервер разбирает вход повторно и не доверяет клиентской валидации.
 */

export const REQUEST_TYPE_CODES = [
  "STUDY_CERTIFICATE",
  "PLACE_REQUIREMENT",
  "ACADEMIC_LEAVE",
  "RETAKE",
] as const;

export const REQUEST_STATUSES = ["NEW", "IN_PROGRESS", "READY", "REJECTED", "CANCELLED"] as const;

export type RequestTypeCode = (typeof REQUEST_TYPE_CODES)[number];
export type RequestStatusValue = (typeof REQUEST_STATUSES)[number];

export const requestTypeCodeSchema = z.enum(REQUEST_TYPE_CODES);
export const requestStatusSchema = z.enum(REQUEST_STATUSES);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату в формате ГГГГ-ММ-ДД")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Укажите корректную дату");

/** Пустая строка из формы означает «поле не заполнено», а не ошибку длины. */
const optionalCommentSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500, "Комментарий не должен превышать 500 символов").optional(),
);

export const studyCertificatePayloadSchema = z.object({
  deliveryPlace: z
    .string()
    .trim()
    .min(5, "Укажите место предоставления справки")
    .max(200, "Место предоставления не должно превышать 200 символов"),
  comment: optionalCommentSchema,
});

export const placeRequirementPayloadSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Укажите организацию")
    .max(200, "Название организации не должно превышать 200 символов"),
  deliveryPlace: z
    .string()
    .trim()
    .min(5, "Укажите место предоставления справки")
    .max(200, "Место предоставления не должно превышать 200 символов"),
  comment: optionalCommentSchema,
});

export const academicLeavePayloadSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, "Опишите причину академического отпуска")
      .max(500, "Причина не должна превышать 500 символов"),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    comment: optionalCommentSchema,
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "Дата окончания не может быть раньше даты начала",
  });

export const retakePayloadSchema = z.object({
  disciplineId: z.cuid("Выберите дисциплину"),
  reason: z
    .string()
    .trim()
    .min(10, "Опишите причину пересдачи")
    .max(500, "Причина не должна превышать 500 символов"),
  comment: optionalCommentSchema,
});

const payloadMember = <Code extends RequestTypeCode, Schema extends z.ZodType>(
  typeCode: Code,
  payload: Schema,
) => z.object({ typeCode: z.literal(typeCode), payload });

/** Пара «тип + поля» для формы: тип не дублируется внутри payload. */
export const requestPayloadSchema = z.discriminatedUnion("typeCode", [
  payloadMember("STUDY_CERTIFICATE", studyCertificatePayloadSchema),
  payloadMember("PLACE_REQUIREMENT", placeRequirementPayloadSchema),
  payloadMember("ACADEMIC_LEAVE", academicLeavePayloadSchema),
  payloadMember("RETAKE", retakePayloadSchema),
]);

const createRequestMember = <Code extends RequestTypeCode, Schema extends z.ZodType>(
  typeCode: Code,
  payload: Schema,
) =>
  z.object({
    typeCode: z.literal(typeCode),
    clientRequestId: z.uuid("Некорректный идентификатор отправки"),
    payload,
  });

/** Вход создания заявки: тип, идемпотентный ключ формы и поля типа. */
export const createRequestSchema = z.discriminatedUnion("typeCode", [
  createRequestMember("STUDY_CERTIFICATE", studyCertificatePayloadSchema),
  createRequestMember("PLACE_REQUIREMENT", placeRequirementPayloadSchema),
  createRequestMember("ACADEMIC_LEAVE", academicLeavePayloadSchema),
  createRequestMember("RETAKE", retakePayloadSchema),
]);

export const requestListQuerySchema = z.object({
  status: requestStatusSchema.optional(),
});

/** Очередь сотрудника: без фильтра — активные заявки, со статусом — выбранная колонка. */
export const requestQueueQuerySchema = z.object({
  status: requestStatusSchema.optional(),
});

export const requestIdSchema = z.cuid("Некорректный идентификатор заявки");

export const cancelRequestSchema = z.object({
  requestId: requestIdSchema,
});

/**
 * Действие сотрудника. Причина отклонения обязательна, поэтому проверяется
 * и схемой, и доменным слоем рядом с данными.
 */
export const requestStatusTransitionSchema = z
  .object({
    requestId: requestIdSchema,
    toStatus: requestStatusSchema,
    comment: optionalCommentSchema,
  })
  .superRefine((value, context) => {
    if (value.toStatus === "REJECTED" && !value.comment) {
      context.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Укажите причину отклонения",
      });
    }
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type RequestPayloadInput = z.infer<typeof requestPayloadSchema>;
export type RequestListQuery = z.infer<typeof requestListQuerySchema>;
export type RequestQueueQuery = z.infer<typeof requestQueueQuerySchema>;
export type RequestStatusTransitionInput = z.infer<typeof requestStatusTransitionSchema>;
