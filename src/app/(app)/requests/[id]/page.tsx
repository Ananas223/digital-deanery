import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EmployeeStatusForm } from "@/components/requests/employee-status-form";
import { RequestPayloadView } from "@/components/requests/request-payload-view";
import { RequestSnapshotNotice } from "@/components/requests/request-snapshot-notice";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { StudentRequestDetail } from "@/components/requests/student-request-detail";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequest } from "@/lib/actions/requests";
import type { RequestDetail } from "@/lib/domain/requests";
import { REQUEST_STATUS_LABELS } from "@/lib/domain/request-status";
import { formatDateTime } from "@/lib/format";
import { requestPayloadSchema, type RequestTypeCode } from "@/lib/validation/requests";

type RequestCardPageProps = {
  params: Promise<{ id: string }>;
};

const loadRequest = cache(getRequest);

/**
 * Проверка существования и доступа до начала стриминга.
 *
 * `notFound()` из тела страницы при включённом `loading.tsx` уже не может
 * изменить HTTP-статус: оболочка отправлена. Метаданные резолвятся раньше,
 * поэтому чужой или несуществующий идентификатор получает честный 404.
 */
export async function generateMetadata({ params }: RequestCardPageProps): Promise<Metadata> {
  const { id } = await params;

  if (!(await loadRequest(id))) {
    notFound();
  }

  return { title: "Карточка заявки" };
}

function hasMixedStatus({ history, status }: Pick<RequestDetail, "history" | "status">) {
  const latest = history.at(-1);
  return latest !== undefined && latest.toStatus !== status;
}

/** The existing action checks ownership for students and queue access for staff. */
export default async function RequestCardPage({ params }: RequestCardPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const { id } = await params;
  let request = await loadRequest(id);
  if (request && hasMixedStatus(request)) {
    // Read the same authoritative contract once more; never infer permissions from history.
    request = await getRequest(id);
  }

  if (!request) {
    notFound();
  }

  if (hasMixedStatus(request)) {
    const employee = user.role === "DEAN_EMPLOYEE";
    return (
      <div className="min-w-0 space-y-5 wrap-anywhere">
        <Link href="/requests" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {employee ? "К очереди" : "Мои заявки"}
        </Link>
        <PageHeader title={request.typeTitle} eyebrow={`№ ${request.number}`} />
        <RequestSnapshotNotice />
      </div>
    );
  }

  if (user.role === "STUDENT") {
    return <StudentRequestDetail request={request} />;
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
                key={request.status}
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
