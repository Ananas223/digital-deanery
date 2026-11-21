import { ArrowRight, FileText, Inbox, Plus } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RequestCatalog } from "@/components/requests/request-catalog";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getMyRequests } from "@/lib/actions/requests";
import { listRequestQueueForActor } from "@/lib/domain/requests";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_ORDER } from "@/lib/domain/request-status";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { requestListQuerySchema, requestQueueQuerySchema } from "@/lib/validation/requests";
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

/** Student requests and the preserved employee queue share an authenticated route. */
export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=%2Frequests");
  }

  if (user.role === "STUDENT") {
    return <StudentRequests searchParams={searchParams} />;
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

async function StudentRequests({ searchParams }: RequestsPageProps) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const parsed = requestListQuerySchema.safeParse(rawStatus ? { status: rawStatus } : {});
  const filter = parsed.success ? parsed.data : {};
  const requests = await getMyRequests(filter);
  const filters = [{ label: "Все", value: undefined }, ...FILTERS.slice(1)];

  return (
    <div className="min-w-0 space-y-6 wrap-anywhere sm:space-y-8">
      <PageHeader
        title="Заявки"
        description="Обращения в деканат и путь от отправки до результата."
        actions={
          <Link href={"/requests/new" as Route} className={buttonVariants()}>
            <Plus aria-hidden="true" className="size-4" /> Создать заявку
          </Link>
        }
      />
      <section aria-labelledby="my-requests-heading" className="min-w-0 space-y-4">
        <h2 id="my-requests-heading" className="text-xl font-semibold text-foreground">
          Мои заявки
        </h2>
        <nav aria-label="Фильтр по статусу" className="flex min-w-0 flex-wrap gap-2">
          {filters.map((item) => (
            <Link
              key={item.label}
              href={(item.value ? `/requests?status=${item.value}` : "/requests") as Route}
              aria-current={filter.status === item.value ? "page" : undefined}
              className={buttonVariants({
                variant: filter.status === item.value ? "primary" : "outline",
                size: "sm",
              })}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {requests.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filter.status ? "В этом статусе заявок нет" : "Заявок пока нет"}
            description={
              filter.status
                ? "Выберите другой статус, чтобы найти обращение."
                : "Выберите справку или заявление. После отправки обращение появится здесь."
            }
            action={
              <Link
                href={filter.status ? "/requests" : ("/requests/new" as Route)}
                className={buttonVariants({ variant: "outline" })}
              >
                {filter.status ? "Все заявки" : "Создать первую заявку"}
              </Link>
            }
          />
        ) : (
          <ul className="min-w-0 space-y-3">
            {requests.map((request) => (
              <li key={request.id} className="min-w-0">
                <Link
                  href={`/requests/${request.id}` as Route}
                  className="group block min-w-0 rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-ring hover:bg-primary-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-muted sm:p-5"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-caption text-muted-foreground">№ {request.number}</p>
                      <h3 className="text-lg leading-6 font-semibold text-foreground">
                        {request.typeTitle}
                      </h3>
                    </div>
                    <RequestStatusBadge status={request.status} />
                  </div>
                  <div className="mt-4 flex min-w-0 items-end justify-between gap-3 border-t border-border pt-3">
                    <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2 sm:gap-x-8">
                      <div>
                        <dt className="text-caption text-muted-foreground">Создана</dt>
                        <dd className="mt-1 text-foreground">
                          {formatDateTime(request.createdAt)}
                        </dd>
                      </div>
                      {request.dueAt ? (
                        <div>
                          <dt className="text-caption text-muted-foreground">
                            Плановая готовность
                          </dt>
                          <dd className="mt-1 text-foreground">{formatDateTime(request.dueAt)}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <ArrowRight aria-hidden="true" className="mb-1 size-4 shrink-0 text-link" />
                  </div>
                  {request.rejectionReason ? (
                    <p className="mt-3 text-meta text-danger-strong">
                      Причина отклонения — {request.rejectionReason}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <RequestCatalog />
    </div>
  );
}
