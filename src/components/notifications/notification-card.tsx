"use client";

import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { NotificationItem } from "@/lib/domain/notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  NOTIFICATION_LABELS,
  NOTIFICATION_SOURCE_LABELS,
  notificationDestination,
} from "./presentation";

type NotificationCardProps = {
  item: NotificationItem;
  busy: boolean;
  saving: boolean;
  archived?: boolean;
  onRead: () => void;
};

export function NotificationCard({
  item,
  busy,
  saving,
  archived = false,
  onRead,
}: NotificationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const headingId = `notification-heading-${item.id}`;
  const contentId = `notification-content-${item.id}`;
  const destination = notificationDestination(item);

  return (
    <article
      id={`notification-${item.id}`}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 scroll-mt-6 rounded-card border bg-card p-4 sm:p-6",
        item.priority === "IMPORTANT" ? "border-link/50" : "border-border",
      )}
    >
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 text-caption">
        <span className="text-muted-foreground">{NOTIFICATION_LABELS[item.category]}</span>
        {item.priority === "IMPORTANT" ? <Badge variant="info">Важное</Badge> : null}
        {!archived && !item.isRead ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-link">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            Непрочитано
          </span>
        ) : null}
      </div>

      <h2 id={headingId} className="text-lg leading-snug font-semibold text-pretty text-foreground">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-11 w-full min-w-0 items-start justify-between gap-3 rounded-md py-1 text-left transition-colors hover:text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="min-w-0 wrap-anywhere">{item.title}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "mt-1 size-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-(--duration-feedback)",
              expanded && "rotate-180",
            )}
          />
        </button>
      </h2>
      <time
        dateTime={new Date(item.publishedAt).toISOString()}
        className="text-caption text-muted-foreground"
      >
        {formatDateTime(item.publishedAt)} МСК
      </time>
      <p className="mt-1 text-caption text-muted-foreground">
        {item.source
          ? `Источник: ${NOTIFICATION_SOURCE_LABELS[item.source]}`
          : "Источник не указан"}
      </p>

      <div id={contentId} hidden={!expanded} className="mt-4 space-y-4 border-t border-border pt-4">
        <p className="max-w-prose text-base leading-relaxed wrap-anywhere whitespace-pre-wrap text-foreground">
          {item.body}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {destination ? (
            <Link href={destination.href} className={buttonVariants({ variant: "outline" })}>
              {destination.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
          {!archived ? (
            <Button
              variant="ghost"
              aria-disabled={item.isRead || busy}
              aria-busy={saving || undefined}
              aria-label={
                item.isRead ? `Прочитано: ${item.title}` : `Отметить прочитанным: ${item.title}`
              }
              onClick={() => {
                if (!item.isRead && !busy) onRead();
              }}
            >
              {saving ? (
                <Spinner aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" className="size-4" />
              )}
              {item.isRead ? "Прочитано" : "Отметить прочитанным"}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
