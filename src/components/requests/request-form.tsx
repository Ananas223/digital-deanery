"use client";

import { ArrowRight, Check, RefreshCw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";

import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createRequest } from "@/lib/actions/requests";
import type { RequestCreated } from "@/lib/domain/requests";
import { formatDateTime } from "@/lib/format";
import {
  createRequestSchema,
  requestPayloadSchema,
  type RequestTypeCode,
} from "@/lib/validation/requests";

export type RequestFormValues = {
  deliveryPlace: string;
  organizationName: string;
  reason: string;
  startDate: string;
  endDate: string;
  disciplineId: string;
  comment: string;
};

export type RequestDiscipline = { id: string; name: string };

type RequestFormProps = {
  typeCode: RequestTypeCode;
  initialValues?: Partial<RequestFormValues>;
  disciplines: RequestDiscipline[];
  disciplinesUnavailable?: boolean;
};

const EMPTY_VALUES: RequestFormValues = {
  deliveryPlace: "",
  organizationName: "",
  reason: "",
  startDate: "",
  endDate: "",
  disciplineId: "",
  comment: "",
};

function getPayload(typeCode: RequestTypeCode, values: RequestFormValues) {
  const comment = values.comment;
  switch (typeCode) {
    case "STUDY_CERTIFICATE":
      return { deliveryPlace: values.deliveryPlace, comment };
    case "PLACE_REQUIREMENT":
      return {
        organizationName: values.organizationName,
        deliveryPlace: values.deliveryPlace,
        comment,
      };
    case "ACADEMIC_LEAVE":
      return {
        reason: values.reason,
        startDate: values.startDate,
        endDate: values.endDate,
        comment,
      };
    case "RETAKE":
      return { disciplineId: values.disciplineId, reason: values.reason, comment };
  }
}

function formResolver(typeCode: RequestTypeCode): Resolver<RequestFormValues> {
  return (values) => {
    const parsed = requestPayloadSchema.safeParse({
      typeCode,
      payload: getPayload(typeCode, values),
    });
    if (parsed.success) return { values, errors: {} };

    const errors: FieldErrors<RequestFormValues> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[1] as keyof RequestFormValues | undefined;
      if (field && field in EMPTY_VALUES && !errors[field]) {
        errors[field] = { type: "validate", message: issue.message };
      }
    }
    return { values: {}, errors };
  };
}

/** Conditional fields use the same schemas that validate the Server Action. */
export function RequestForm({
  typeCode,
  initialValues,
  disciplines,
  disciplinesUnavailable = false,
}: RequestFormProps) {
  const router = useRouter();
  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RequestCreated | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, submitCount },
  } = useForm<RequestFormValues>({
    defaultValues: { ...EMPTY_VALUES, ...initialValues },
    mode: "onBlur",
    reValidateMode: "onBlur",
    resolver: formResolver(typeCode),
  });

  const retake = typeCode === "RETAKE";
  const missingDisciplines = retake && disciplines.length === 0;
  const validationMessages = Array.from(
    new Set(Object.values(errors).flatMap((field) => (field?.message ? [field.message] : []))),
  );
  const showValidationSummary = submitCount > 0 && validationMessages.length > 0;

  useEffect(() => {
    if (created) receiptHeading.current?.focus({ preventScroll: true });
  }, [created]);

  async function submit(values: RequestFormValues) {
    if (inFlight.current) return;
    const payload = getPayload(typeCode, values);
    const parsedPayload = requestPayloadSchema.safeParse({ typeCode, payload });
    if (!parsedPayload.success) return;

    // A lost response must keep the same request even if its fields are edited.
    if (!submissionId.current) {
      submissionId.current = crypto.randomUUID();
    }
    const parsed = createRequestSchema.safeParse({
      ...parsedPayload.data,
      clientRequestId: submissionId.current,
    });
    if (!parsed.success) {
      setError("Не удалось подготовить заявку. Проверьте поля и попробуйте ещё раз.");
      return;
    }

    inFlight.current = true;
    // Lock the controls only for a valid request, not while validation moves focus.
    setIsSending(true);
    try {
      const result = await createRequest(parsed.data);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCreated(result.data);
      router.refresh();
    } catch {
      setError(
        "Не удалось получить подтверждение. Проверьте подключение и отправьте заявку ещё раз.",
      );
    } finally {
      inFlight.current = false;
      setIsSending(false);
    }
  }

  if (created) {
    return (
      <section aria-labelledby="request-created-heading" className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-muted text-success-strong">
            <Check aria-hidden="true" className="size-5" />
          </span>
          <div role="status" className="min-w-0 space-y-1">
            <h2
              ref={receiptHeading}
              id="request-created-heading"
              tabIndex={-1}
              className="rounded-sm text-xl font-semibold text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Заявка отправлена
            </h2>
            <p className="text-meta text-muted-foreground">Деканат получил ваше обращение.</p>
          </div>
        </div>
        <div className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold text-foreground">№ {created.number}</p>
            <RequestStatusBadge status={created.status} />
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Создана</dt>
              <dd className="mt-1 text-foreground">{formatDateTime(created.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Плановая готовность</dt>
              <dd className="mt-1 text-foreground">
                {created.dueAt
                  ? formatDateTime(created.dueAt)
                  : "Деканат уточнит срок при обработке"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/requests/${created.id}` as Route} className={buttonVariants()}>
            Открыть заявку <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href="/requests" className={buttonVariants({ variant: "outline" })}>
            Мои заявки
          </Link>
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            На главную
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current) return;
        setError(null);
        void handleSubmit(submit)(event);
      }}
      aria-labelledby="request-form-heading"
      aria-busy={isSending || undefined}
      className="space-y-5"
      noValidate
    >
      <h2 id="request-form-heading" className="text-xl font-semibold text-foreground">
        Данные обращения
      </h2>
      <div
        role="status"
        aria-atomic="true"
        className={
          showValidationSummary
            ? "space-y-1 rounded-card border border-danger/30 bg-danger-muted p-4 text-sm text-foreground"
            : "sr-only"
        }
      >
        {showValidationSummary ? <p className="font-semibold">Проверьте поля заявки</p> : null}
        {validationMessages.length > 0 ? (
          <ul className="list-disc space-y-1 ps-5">
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? (
        <Alert tone="danger" title="Заявка не подтверждена">
          {error}
        </Alert>
      ) : null}
      {retake && disciplinesUnavailable ? (
        <Alert
          tone="warning"
          title="Не все учебные данные доступны"
          action={
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              <RefreshCw aria-hidden="true" className="size-4" /> Обновить
            </Button>
          }
        >
          Попробуйте обновить список дисциплин. Введённые поля сохранятся.
        </Alert>
      ) : null}
      {missingDisciplines && !disciplinesUnavailable ? (
        <Alert tone="info" title="Дисциплины пока не появились">
          Когда учебные данные будут доступны в кабинете, здесь можно будет выбрать дисциплину для
          пересдачи.
          <Link href="/grades" className="ml-1 font-medium underline underline-offset-4">
            Открыть успеваемость
          </Link>
        </Alert>
      ) : null}
      <fieldset className="min-w-0 space-y-5" disabled={isSending}>
        <legend className="sr-only">Обязательные поля и комментарий</legend>
        {typeCode === "PLACE_REQUIREMENT" ? (
          <Field
            id="request-organization"
            label="Организация"
            hint="Полное название организации, для которой нужна справка."
            required
            error={errors.organizationName?.message}
          >
            {(control) => (
              <Input
                {...control}
                aria-invalid={control["aria-invalid"] ?? false}
                {...register("organizationName")}
                required
                minLength={2}
                maxLength={200}
                autoComplete="organization"
              />
            )}
          </Field>
        ) : null}
        {typeCode === "STUDY_CERTIFICATE" || typeCode === "PLACE_REQUIREMENT" ? (
          <Field
            id="request-delivery"
            label="Место предоставления"
            hint="Укажите, куда вы предоставите справку. От 5 до 200 символов."
            required
            error={errors.deliveryPlace?.message}
          >
            {(control) => (
              <Input
                {...control}
                aria-invalid={control["aria-invalid"] ?? false}
                {...register("deliveryPlace")}
                required
                minLength={5}
                maxLength={200}
              />
            )}
          </Field>
        ) : null}
        {retake ? (
          <Field
            id="request-discipline"
            label="Дисциплина"
            hint="Дисциплины из ваших оценок и расписания сессии."
            required
            error={errors.disciplineId?.message}
          >
            {(control) => (
              <Select
                {...control}
                aria-invalid={control["aria-invalid"] ?? false}
                {...register("disciplineId")}
                required
                disabled={missingDisciplines}
              >
                <option value="">Выберите дисциплину</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        {typeCode === "ACADEMIC_LEAVE" || retake ? (
          <Field
            id="request-reason"
            label={retake ? "Причина пересдачи" : "Причина академического отпуска"}
            hint="Опишите ситуацию. От 10 до 500 символов."
            required
            error={errors.reason?.message}
          >
            {(control) => (
              <Textarea
                {...control}
                aria-invalid={control["aria-invalid"] ?? false}
                {...register("reason")}
                required
                minLength={10}
                maxLength={500}
              />
            )}
          </Field>
        ) : null}
        {typeCode === "ACADEMIC_LEAVE" ? (
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <Field
              id="request-start"
              label="Дата начала"
              required
              error={errors.startDate?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  {...register("startDate")}
                  aria-invalid={control["aria-invalid"] ?? false}
                  type="date"
                  required
                />
              )}
            </Field>
            <Field id="request-end" label="Дата окончания" required error={errors.endDate?.message}>
              {(control) => (
                <Input
                  {...control}
                  {...register("endDate")}
                  aria-invalid={control["aria-invalid"] ?? false}
                  type="date"
                  required
                />
              )}
            </Field>
          </div>
        ) : null}
        <Field
          id="request-comment"
          label="Комментарий"
          hint="Необязательно. До 500 символов."
          error={errors.comment?.message}
        >
          {(control) => (
            <Textarea
              {...control}
              {...register("comment")}
              aria-invalid={control["aria-invalid"] ?? false}
              maxLength={500}
            />
          )}
        </Field>
      </fieldset>
      <p className="text-meta text-muted-foreground">
        После отправки вы получите номер заявки и сможете следить за её статусом в кабинете.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={isSending} disabled={missingDisciplines}>
          {isSending ? "Отправляем заявку" : "Отправить заявку"}
          {!isSending ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
        </Button>
        <Link href="/requests" className={buttonVariants({ variant: "ghost" })}>
          К моим заявкам
        </Link>
      </div>
    </form>
  );
}
