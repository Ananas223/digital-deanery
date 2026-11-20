import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmployeeStatusForm } from "@/components/requests/employee-status-form";
import { RequestPayloadView } from "@/components/requests/request-payload-view";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequest } from "@/lib/domain/requests";
import { REQUEST_STATUS_LABELS } from "@/lib/domain/request-status";
import { formatDateTime } from "@/lib/format";
import { requestPayloadSchema, type RequestTypeCode } from "@/lib/validation/requests";

export const metadata: Metadata = {
  title: "Карточка заявки",
};

type RequestCardPageProps = {
  params: Promise<{ id: string }>;
};

/** Карточка заявки для сотрудника: данные студента, история и смена статуса. */
export default async function RequestCardPage({ params }: RequestCardPageProps) {
  const user = await getCurrentUser();

  // Студенческий экран появится отдельной задачей; чужой маршрут — нейтральный 404.
  if (!user || user.role !== "DEAN_EMPLOYEE") {
    notFound();
  }

  const { id } = await params;
  const request = await getRequest({ userId: user.id, role: user.role }, id);

  if (!request) {
    notFound();
  }

  const parsedPayload = requestPayloadSchema.safeParse({
    typeCode: request.typeCode as RequestTypeCode,
    payload: request.payload,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/requests" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />К очереди
        </Link>
      </div>

      <PageHeader
        eyebrow={`№ ${request.number}`}
        title={request.typeTitle}
        description={`Создана ${formatDateTime(request.createdAt)}`}
        actions={<RequestStatusBadge status={request.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Заявка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsedPayload.success ? (
                <RequestPayloadView
                  payload={parsedPayload.data}
                  disciplineName={request.disciplineName}
                />
              ) : (
                <Alert tone="warning" title="Данные заявки недоступны">
                  Сохранённые поля не соответствуют текущей форме. Проверьте заявку вручную.
                </Alert>
              )}

              {request.rejectionReason ? (
                <Alert tone="danger" title="Причина отклонения">
                  {request.rejectionReason}
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>История обработки</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {request.history.map((entry, index) => (
                  <li key={entry.id} className="relative border-l border-border pl-4">
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 -left-1.25 size-2.5 rounded-full bg-primary"
                    />
                    <p className="text-sm font-medium text-foreground">
                      {entry.fromStatus
                        ? `${REQUEST_STATUS_LABELS[entry.fromStatus]} → ${REQUEST_STATUS_LABELS[entry.toStatus]}`
                        : `Создана: ${REQUEST_STATUS_LABELS[entry.toStatus]}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                      {entry.changedByName ? ` · ${entry.changedByName}` : ""}
                    </p>
                    {entry.comment ? (
                      <p className="mt-1 text-sm text-foreground">{entry.comment}</p>
                    ) : null}
                    {index === request.history.length - 1 ? null : (
                      <span className="sr-only">Следующее событие</span>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Студент</CardTitle>
            </CardHeader>
            <CardContent>
              {request.student ? (
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">ФИО</dt>
                    <dd className="font-medium text-foreground">{request.student.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Группа</dt>
                    <dd className="text-foreground">{request.student.groupCode}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Номер студенческого</dt>
                    <dd className="text-foreground">{request.student.studentNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Факультет</dt>
                    <dd className="text-foreground">{request.student.facultyName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Программа</dt>
                    <dd className="text-foreground">{request.student.programName}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Данные студента недоступны.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Обработка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Срок</dt>
                  <dd className="text-foreground">
                    {request.dueAt ? formatDateTime(request.dueAt) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Исполнитель</dt>
                  <dd className="text-foreground">{request.assignedToName ?? "Не назначен"}</dd>
                </div>
              </dl>

              <EmployeeStatusForm
                requestId={request.id}
                allowedTransitions={request.allowedTransitions}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
