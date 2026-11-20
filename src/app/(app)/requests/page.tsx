import { FileText, Inbox } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";

import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listRequestQueueForActor } from "@/lib/domain/requests";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_ORDER } from "@/lib/domain/request-status";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { requestQueueQuerySchema } from "@/lib/validation/requests";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Заявки",
};

const FILTERS = [
  { label: "Активные", value: undefined },
  ...REQUEST_STATUS_ORDER.map((status) => ({
    label: REQUEST_STATUS_LABELS[status],
    value: status,
  })),
] as const;

type RequestsPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

/** Раздел «Заявки»: у студента — каркас, у сотрудника — очередь обработки (US-11). */
export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const user = await getCurrentUser();

  if (!user || user.role !== "DEAN_EMPLOYEE") {
    return <StudentRequestsStub />;
  }

  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const parsedQuery = requestQueueQuerySchema.safeParse(rawStatus ? { status: rawStatus } : {});
  const filter = parsedQuery.success ? parsedQuery.data : {};
  const requests = await listRequestQueueForActor({ userId: user.id, role: user.role }, filter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Кабинет сотрудника"
        title="Очередь заявок"
        description="Новые и взятые в работу обращения студентов. Откройте карточку, чтобы изменить статус и оставить комментарий."
      />

      <nav aria-label="Фильтр по статусу" className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const isActive = filter.status === item.value;
          const href = (item.value ? `/requests?status=${item.value}` : "/requests") as Route;

          return (
            <Link
              key={item.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: isActive ? "primary" : "outline", size: "sm" }),
                "min-h-9",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Очередь пуста"
          description={
            filter.status
              ? "В этом статусе заявок нет. Выберите другой фильтр или вернитесь к активным заявкам."
              : "Новых и взятых в работу заявок нет. Когда студент отправит обращение, оно появится здесь."
          }
          action={
            filter.status ? (
              <Link href="/requests" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Показать активные
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/requests/${request.id}` as Route}
                className="block rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-ring/60 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      № {request.number}
                    </p>
                    <h2 className="text-base font-semibold text-foreground">{request.typeTitle}</h2>
                    <p className="text-sm text-foreground">
                      {request.studentName} · {request.groupCode}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {request.facultyName} · {request.studentNumber}
                    </p>
                  </div>
                  <RequestStatusBadge status={request.status} />
                </div>

                <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <dt className="text-muted-foreground">Создана</dt>
                    <dd className="min-w-0 text-foreground">{formatDateTime(request.createdAt)}</dd>
                  </div>
                  <div className="flex min-w-0 items-baseline gap-2">
                    <dt className="text-muted-foreground">Срок</dt>
                    <dd className="min-w-0 text-foreground">
                      {request.dueAt ? formatDateTime(request.dueAt) : "—"}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-baseline gap-2 sm:col-span-2">
                    <dt className="text-muted-foreground">Исполнитель</dt>
                    <dd className="min-w-0 text-foreground">
                      {request.assignedToName ?? "Не назначен"}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentRequestsStub() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Заявки"
        description="Справки и заявления: тип, номер, дата, текущий статус и история обработки."
      />

      <EmptyState
        icon={FileText}
        title="Заявок пока нет"
        description="Здесь появятся ваши обращения в деканат и их статусы: «Новая», «В работе», «Готова», «Отклонена». Каталог типов и форма заявки откроются вместе с данными кабинета."
      />
    </div>
  );
}
