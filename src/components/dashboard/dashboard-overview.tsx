import { ArrowRight, CalendarDays, FilePlus2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { NOTIFICATION_LABELS } from "@/components/notifications/presentation";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardData, type DashboardData } from "@/lib/domain/dashboard";
import { getAssessmentTypeLabel } from "@/lib/domain/grades";
import { formatDateTime, formatNumber } from "@/lib/format";
import { gradesHref } from "@/lib/ui/grades-query";

import { OverviewError } from "./overview-error";

const summaryLink =
  "inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

function SummarySection({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: Route;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card role="region" aria-label={title}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <CardTitle>{title}</CardTitle>
        <Link href={href} className={summaryLink}>
          {linkLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function GradesOverview({ data }: { data: DashboardData }) {
  if (data.unavailable.includes("gradesSummary")) {
    return (
      <OverviewError
        title="Учёба не загрузилась"
        description="Попробуйте обновить сводку или откройте раздел успеваемости."
        href="/grades"
        linkLabel="Открыть успеваемость"
      />
    );
  }

  const summary = data.gradesSummary;
  const exam = data.nearestExam;
  return (
    <SummarySection title="Учёба" href="/grades" linkLabel="Все оценки">
      <div className="space-y-4">
        {summary && summary.state !== "NO_DATA" ? (
          <>
            <dl className="grid min-w-0 grid-cols-2 gap-4">
              <div>
                <dt className="text-caption text-muted-foreground">Средний балл</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {summary.averageScore === null
                    ? "—"
                    : formatNumber(summary.averageScore, { maximumFractionDigits: 2 })}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Задолженности</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {formatNumber(summary.debtCount)}
                </dd>
              </div>
            </dl>
            <p
              className={
                summary.state === "DEBTS"
                  ? "text-sm text-danger-strong"
                  : "text-sm text-muted-foreground"
              }
            >
              {summary.message}
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            За семестр пока нет данных об оценках.
          </p>
        )}

        <div className="min-w-0 space-y-1 border-t border-border pt-4">
          <p className="text-caption text-muted-foreground">Ближайший экзамен или зачёт</p>
          {data.unavailable.includes("nearestExam") ? (
            <p className="text-sm text-muted-foreground">Расписание сессии временно недоступно.</p>
          ) : exam ? (
            <Link
              href={gradesHref(
                { tab: "session", disciplineId: exam.discipline.id },
                "discipline-detail",
              )}
              className="block min-h-11 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <p className="font-medium wrap-anywhere text-link">{exam.discipline.name}</p>
              <p className="mt-1 text-caption text-muted-foreground">
                {getAssessmentTypeLabel(exam.assessmentType)} · {formatDateTime(exam.startsAt)} МСК
              </p>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Ближайших экзаменов и зачётов нет.</p>
          )}
        </div>
      </div>
    </SummarySection>
  );
}

function RequestsOverview({ data }: { data: DashboardData }) {
  if (data.unavailable.includes("activeRequests")) {
    return (
      <OverviewError
        title="Заявки не загрузились"
        description="Попробуйте обновить сводку или откройте раздел заявок."
        href="/requests"
        linkLabel="Открыть заявки"
      />
    );
  }

  return (
    <SummarySection title="Активные заявки" href="/requests" linkLabel="Все">
      {data.activeRequests.length ? (
        <ul role="list" className="divide-y divide-border">
          {data.activeRequests.map((request) => (
            <li key={request.id} className="min-w-0 first:pt-0 last:pb-0">
              <Link
                href={`/requests/${encodeURIComponent(request.id)}` as Route}
                className="block min-h-11 space-y-2 rounded-md py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="text-caption text-muted-foreground">{request.number}</span>
                  <RequestStatusBadge status={request.status} />
                </div>
                <p className="text-sm font-medium wrap-anywhere text-link">{request.typeTitle}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Активных заявок нет.</p>
          <Link href="/requests/new" className={summaryLink}>
            <FilePlus2 aria-hidden="true" className="size-4" />
            Заказать справку
          </Link>
        </div>
      )}
    </SummarySection>
  );
}

function NotificationsOverview({ data }: { data: DashboardData }) {
  if (data.unavailable.includes("unreadNotifications")) {
    return (
      <OverviewError
        title="Уведомления не загрузились"
        description="Попробуйте обновить сводку или откройте ленту уведомлений."
        href="/notifications"
        linkLabel="Открыть уведомления"
      />
    );
  }

  const { count, items } = data.unreadNotifications;
  return (
    <SummarySection title="Уведомления" href="/notifications" linkLabel="В ленту">
      <p className="mb-3 text-sm text-muted-foreground">
        {count === 0 ? "Непрочитанных нет." : `Непрочитанных ${formatNumber(count)}`}
      </p>
      {items.length ? (
        <ul role="list" className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <Link
                href={{ pathname: "/notifications", query: { category: item.category } }}
                className="block min-h-11 space-y-1.5 rounded-md py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-caption text-muted-foreground">
                    {NOTIFICATION_LABELS[item.category]}
                  </span>
                  {item.priority === "IMPORTANT" ? <Badge variant="info">Важное</Badge> : null}
                </div>
                <p className="text-sm font-medium wrap-anywhere text-link">{item.title}</p>
                <time
                  dateTime={new Date(item.publishedAt).toISOString()}
                  className="block text-caption text-muted-foreground"
                >
                  {formatDateTime(item.publishedAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Объявления и изменения можно посмотреть в общей ленте.
        </p>
      )}
    </SummarySection>
  );
}

/** Independent server blocks use the v4 aggregate without inventing empty values after failures. */
export async function DashboardOverview({ userId, now }: { userId: string; now: Date }) {
  let data: DashboardData;
  try {
    data = await getDashboardData(userId, now);
  } catch {
    return (
      <OverviewError
        title="Сводка не загрузилась"
        description="Попробуйте обновить её или откройте нужный раздел в меню."
        href="/grades"
        linkLabel="Открыть успеваемость"
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <GradesOverview data={data} />
      <RequestsOverview data={data} />
      <NotificationsOverview data={data} />
      {data.unavailable.includes("student") ? (
        <OverviewError
          title="Учебные сведения не загрузились"
          description="Попробуйте обновить сводку или откройте профиль."
          href="/profile"
          linkLabel="Открыть профиль"
        />
      ) : (
        <Link
          href="/profile"
          className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-2 rounded-md px-1 py-2 text-sm text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span>
            {data.student ? `Группа ${data.student.groupCode}` : "Учебные сведения не найдены"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            Профиль
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      )}
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <div role="status" aria-label="Загружаем сводку" className="space-y-4">
      {[0, 1, 2].map((index) => (
        <Card key={index} className="space-y-4 p-4 sm:p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </Card>
      ))}
      <span className="sr-only">Загружаем сводку.</span>
    </div>
  );
}

export function DashboardQuickActions() {
  return (
    <section
      aria-labelledby="dashboard-actions-heading"
      className="min-w-0 space-y-2 border-t border-border pt-4"
    >
      <h2 id="dashboard-actions-heading" className="text-base font-semibold text-foreground">
        Быстрые действия
      </h2>
      <div className="flex min-w-0 flex-wrap gap-2">
        <Link href="/requests/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <FilePlus2 aria-hidden="true" className="size-4" />
          Заказать справку
        </Link>
        <Link
          href="/schedule?view=week"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          Расписание на неделю
        </Link>
        <Link href="/grades" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Все оценки
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
