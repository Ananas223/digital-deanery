import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Printer, RotateCcw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { CancelRequestButton } from "@/components/requests/cancel-request-button";
import { RequestPayloadView } from "@/components/requests/request-payload-view";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { isCertificateType } from "@/lib/domain/certificates";
import type { RequestDetail } from "@/lib/domain/requests";
import { REQUEST_STATUS_LABELS } from "@/lib/domain/request-status";
import { buildRequestTimeline, type RequestTimelineState } from "@/lib/domain/request-timeline";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestPayloadSchema } from "@/lib/validation/requests";

const TIMELINE_STATE_LABELS: Record<RequestTimelineState, string> = {
  done: "Выполнено",
  current: "Сейчас",
  upcoming: "Впереди",
  stopped: "Остановлено",
};

const NEXT_STEPS = {
  NEW: "Обращение зарегистрировано. Деканат возьмёт его в работу. Пока обработка не началась, заявку можно отменить.",
  IN_PROGRESS: "Деканат обрабатывает обращение. Результат появится здесь и в уведомлениях.",
  READY:
    "Обращение обработано. Для получения документа обратитесь в деканат и назовите номер заявки. Уточнения сотрудника смотрите в истории.",
  REJECTED:
    "Прочитайте причину отклонения. Вы можете создать повторную заявку и исправить данные перед отправкой.",
  CANCELLED: "Вы отменили обращение. Если вопрос снова актуален, создайте новую заявку.",
} as const;

export function StudentRequestDetail({ request }: { request: RequestDetail }) {
  const parsedPayload = requestPayloadSchema.safeParse({
    typeCode: request.typeCode,
    payload: request.payload,
  });
  const repeatable = request.status === "REJECTED" || request.status === "CANCELLED";
  const printable = request.status === "READY" && isCertificateType(request.typeCode);
  const timeline = buildRequestTimeline(request);

  return (
    <div className="min-w-0 space-y-5 wrap-anywhere sm:space-y-6">
      <Link href="/requests" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft aria-hidden="true" className="size-4" /> Мои заявки
      </Link>
      <PageHeader
        eyebrow={`№ ${request.number}`}
        title={request.typeTitle}
        description={`Создана ${formatDateTime(request.createdAt)}`}
        actions={<RequestStatusBadge status={request.status} />}
      />
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Доставка заявки</CardTitle>
            </CardHeader>
            <CardContent>
              <ol aria-label="Ход обработки заявки" className="space-y-0">
                {timeline.map((step, index) => (
                  <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1 size-2.5 shrink-0 rounded-full border-2",
                          step.state === "done" && "border-success-strong bg-success-strong",
                          step.state === "current" && "border-link bg-link",
                          step.state === "upcoming" && "border-border bg-card",
                          step.state === "stopped" &&
                            (step.tone === "danger"
                              ? "border-danger-strong bg-danger-strong"
                              : "border-muted-foreground bg-muted-foreground"),
                        )}
                      />
                      {index < timeline.length - 1 ? (
                        <span aria-hidden="true" className="mt-1 w-px flex-1 bg-border" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {step.label}
                        <span className="ml-2 text-caption font-normal text-muted-foreground">
                          {TIMELINE_STATE_LABELS[step.state]}
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{step.description}</p>
                      {step.at ? (
                        <p className="mt-1 text-caption text-muted-foreground">
                          <time dateTime={step.at.toISOString()}>{formatDateTime(step.at)}</time>
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          {request.rejectionReason ? (
            <Alert tone="danger" title="Причина отклонения">
              {request.rejectionReason}
            </Alert>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Данные обращения</CardTitle>
            </CardHeader>
            <CardContent>
              {parsedPayload.success ? (
                <RequestPayloadView
                  payload={parsedPayload.data}
                  disciplineName={request.disciplineName}
                />
              ) : (
                <Alert tone="warning" title="Поля заявки недоступны">
                  Не удалось отобразить сохранённые поля. Обратитесь в деканат и назовите номер
                  заявки.
                </Alert>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>История обработки</CardTitle>
            </CardHeader>
            <CardContent>
              {request.history.length ? (
                <ol className="space-y-5">
                  {request.history.map((entry) => (
                    <li key={entry.id} className="relative border-l border-border pl-5">
                      <span
                        aria-hidden="true"
                        className="absolute top-1 -left-1.5 size-3 rounded-full border-2 border-card bg-link"
                      />
                      <p className="text-sm font-semibold text-foreground">
                        {entry.fromStatus
                          ? `${REQUEST_STATUS_LABELS[entry.fromStatus]} → ${REQUEST_STATUS_LABELS[entry.toStatus]}`
                          : "Заявка зарегистрирована"}
                      </p>
                      <p className="mt-1 text-caption text-muted-foreground">
                        <time dateTime={entry.createdAt.toISOString()}>
                          {formatDateTime(entry.createdAt)}
                        </time>
                        {entry.changedByName ? ` · ${entry.changedByName}` : ""}
                      </p>
                      {entry.comment ? (
                        <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-foreground">
                          {entry.comment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-meta text-muted-foreground">
                  История обработки пока не появилась.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <aside className="min-w-0 space-y-4" aria-label="Срок и дальнейшие действия">
          <Card>
            <CardHeader>
              <CardTitle>Что дальше</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start gap-3">
                {request.status === "READY" ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-success-strong"
                  />
                ) : (
                  <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-link" />
                )}
                <p className="text-sm leading-6 text-foreground">{NEXT_STEPS[request.status]}</p>
              </div>
              {printable ? (
                <Link
                  href={`/requests/${request.id}/print` as Route}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Printer aria-hidden="true" className="size-4" /> Печать справки
                </Link>
              ) : null}
              {request.dueAt ? (
                <dl className="border-t border-border pt-4 text-sm">
                  <dt className="text-muted-foreground">Плановая готовность</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    <time dateTime={request.dueAt.toISOString()}>
                      {formatDateTime(request.dueAt)}
                    </time>
                  </dd>
                </dl>
              ) : null}
              <dl className="border-t border-border pt-4 text-sm">
                <dt className="text-muted-foreground">Кто держит заявку</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {request.assignedToName ?? "Деканат"}
                </dd>
              </dl>
              {request.canCancel ? <CancelRequestButton requestId={request.id} /> : null}
              {repeatable ? (
                <Link
                  href={`/requests/new?repeat=${request.id}` as Route}
                  className={buttonVariants()}
                >
                  <RotateCcw aria-hidden="true" className="size-4" /> Создать повторно
                </Link>
              ) : null}
            </CardContent>
          </Card>
          <Link
            href="/notifications?category=REQUESTS"
            className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Уведомления по заявкам <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
