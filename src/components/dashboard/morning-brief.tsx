import { ArrowRight, Clock3, Flag, RefreshCw, Sun } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMorningBrief,
  type MorningBriefAction,
  type MorningBriefBlockKey,
  type MorningBriefChange,
  type MorningBriefData,
  type MorningBriefLesson,
} from "@/lib/domain/dashboard";
import { formatDateTime } from "@/lib/format";
import { formatScheduleTime } from "@/lib/ui/schedule-format";

import { OverviewError } from "./overview-error";

const cardLink =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

function BriefCard({
  title,
  icon: Icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: typeof Clock3;
  href: Route;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card role="region" aria-label={title} className="min-w-0">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-link" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        <Link href={href} className={cardLink}>
          {linkLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function NowCard({ lesson }: { lesson: MorningBriefLesson }) {
  return (
    <BriefCard
      title={lesson.kind === "current" ? "Сейчас" : "Далее"}
      icon={Clock3}
      href={`/schedule/${lesson.lessonId}` as Route}
      linkLabel="Открыть занятие"
    >
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{lesson.disciplineName}</p>
        <p className="text-sm text-foreground">
          {lesson.typeLabel} · {formatScheduleTime(lesson.startsAt)}–
          {formatScheduleTime(lesson.endsAt)}
        </p>
        <p className="text-sm text-muted-foreground">
          Ауд. {lesson.roomNumber} · {lesson.buildingName}
        </p>
        {lesson.changeLabel ? (
          <p className="text-caption font-medium text-warning-strong">
            Изменение: {lesson.changeLabel}
          </p>
        ) : null}
      </div>
    </BriefCard>
  );
}

function ChangesCard({ changes }: { changes: MorningBriefChange[] }) {
  return (
    <BriefCard title="Изменилось" icon={RefreshCw} href="/notifications" linkLabel="Все события">
      <ul className="space-y-3">
        {changes.map((change) => (
          <li key={change.id} className="min-w-0">
            <Link
              href={change.href as Route}
              className="block min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <p className="text-sm font-semibold text-foreground">{change.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{change.body}</p>
              <p className="mt-1 text-caption text-muted-foreground">
                <time dateTime={change.publishedAt.toISOString()}>
                  {formatDateTime(change.publishedAt)}
                </time>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </BriefCard>
  );
}

function ActionCard({ action }: { action: MorningBriefAction }) {
  return (
    <BriefCard title="Требует действия" icon={Flag} href={action.href as Route} linkLabel="Открыть">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{action.title}</p>
        <p className="text-sm text-muted-foreground">{action.description}</p>
        {action.at ? (
          <p className="text-caption text-muted-foreground">
            <time dateTime={action.at.toISOString()}>{formatDateTime(action.at)}</time>
          </p>
        ) : null}
      </div>
    </BriefCard>
  );
}

function BriefError({ block }: { block: MorningBriefBlockKey }) {
  const copy = {
    now: {
      title: "Ближайшая пара не загрузилась",
      description: "Откройте расписание, чтобы проверить занятия.",
      href: "/schedule" as Route,
      linkLabel: "Открыть расписание",
    },
    changes: {
      title: "Изменения не загрузились",
      description: "Свежие события доступны в ленте уведомлений.",
      href: "/notifications" as Route,
      linkLabel: "Открыть уведомления",
    },
    action: {
      title: "Подсказка не загрузилась",
      description: "Проверьте заявки и успеваемость в соответствующих разделах.",
      href: "/requests" as Route,
      linkLabel: "Открыть заявки",
    },
  }[block];

  return (
    <OverviewError
      title={copy.title}
      description={copy.description}
      href={copy.href}
      linkLabel={copy.linkLabel}
    />
  );
}

function MorningBriefView({ data }: { data: MorningBriefData }) {
  const blocks: React.ReactNode[] = [];

  if (data.now) {
    blocks.push(<NowCard key="now" lesson={data.now} />);
  } else if (data.unavailable.includes("now")) {
    blocks.push(<BriefError key="now" block="now" />);
  }

  if (data.changes.length > 0) {
    blocks.push(<ChangesCard key="changes" changes={data.changes} />);
  } else if (data.unavailable.includes("changes")) {
    blocks.push(<BriefError key="changes" block="changes" />);
  }

  if (data.action) {
    blocks.push(<ActionCard key="action" action={data.action} />);
  } else if (data.unavailable.includes("action")) {
    blocks.push(<BriefError key="action" block="action" />);
  }

  if (blocks.length === 0) {
    return (
      <EmptyState
        title="Пока всё спокойно"
        description="На сегодня нет занятий, изменений и срочных дел. Загляните в разделы, если хотите проверить детали."
        icon={Sun}
      />
    );
  }

  return <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">{blocks}</div>;
}

export async function MorningBrief({ userId, now }: { userId: string; now: Date }) {
  const data = await getMorningBrief(userId, now);
  return <MorningBriefView data={data} />;
}

/** Скелетон повторяет сетку трёх карточек и не сдвигает остальные блоки. */
export function MorningBriefSkeleton() {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <Card key={index} className="min-h-40">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
