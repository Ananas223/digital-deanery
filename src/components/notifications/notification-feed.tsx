"use client";

import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { NotificationPage } from "@/lib/domain/notifications";
import { formatNumber } from "@/lib/format";
import {
  NOTIFICATION_FILTER_CATEGORIES,
  type NotificationFilterCategory,
} from "@/lib/validation/notifications";

import { NotificationCard } from "./notification-card";
import { NOTIFICATION_LABELS } from "./presentation";

type NotificationFeedProps = {
  category: NotificationFilterCategory;
  initialPage: NotificationPage | null;
};

export function NotificationFeed({ category, initialPage }: NotificationFeedProps) {
  const router = useRouter();
  const [serverPage, setServerPage] = useState(initialPage);
  const [page, setPage] = useState(initialPage);
  const [unreadCount, setUnreadCount] = useState<number | null>(initialPage?.unreadCount ?? null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loadedMore, setLoadedMore] = useState(false);
  const busy = useRef(false);
  const lastAttempt = useRef<(() => Promise<void>) | null>(null);

  // A server refresh can add events or change reads while this client stays mounted.
  // Keep keyed cards mounted so an expanded card and its focused control survive.
  if (initialPage !== serverPage) {
    setServerPage(initialPage);
    setPage(initialPage);
    setUnreadCount(initialPage?.unreadCount ?? null);
    setLoadedMore(false);
  }

  async function perform(key: string, operation: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    lastAttempt.current = () => perform(key, operation);
    setPending(key);
    setError(null);
    setNotice("");
    try {
      await operation();
    } catch {
      setError("Не удалось выполнить действие. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function refreshCount() {
    try {
      setUnreadCount(await getUnreadCount());
    } catch {
      setUnreadCount(null);
    }
    router.refresh();
  }

  async function reload() {
    await perform("reload", async () => {
      const fresh = await getNotifications({ category });
      setPage(fresh);
      setUnreadCount(fresh.unreadCount);
      setLoadedMore(false);
      setNotice("Лента обновлена.");
      router.refresh();
    });
  }

  async function markRead(id: string) {
    await perform(id, async () => {
      const result = await markNotificationRead(id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPage(
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
          },
      );
      await refreshCount();
      setNotice("Уведомление отмечено прочитанным.");
    });
  }

  async function markAllRead() {
    if (!page || unreadCount === 0) return;
    await perform("all", async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPage(
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) => ({ ...item, isRead: true })),
          },
      );
      await refreshCount();
      setNotice("Уведомления отмечены прочитанными.");
    });
  }

  async function loadMore() {
    const cursor = page?.nextCursor;
    if (!cursor) return;
    await perform("more", async () => {
      const more = await getNotifications({ category }, cursor);
      setPage((current) => {
        if (!current) return more;
        const existing = new Set(current.items.map((item) => item.id));
        return {
          ...more,
          items: [...current.items, ...more.items.filter((item) => !existing.has(item.id))],
        };
      });
      setUnreadCount(more.unreadCount);
      setLoadedMore(true);
      setNotice(
        more.nextCursor ? "Следующие уведомления загружены." : "Все уведомления загружены.",
      );
    });
  }

  return (
    <div className="min-w-0 space-y-5">
      <nav aria-label="Категории уведомлений" className="flex min-w-0 flex-wrap gap-2">
        {NOTIFICATION_FILTER_CATEGORIES.map((value) => (
          <Link
            key={value}
            href={
              value === "ALL"
                ? "/notifications"
                : { pathname: "/notifications", query: { category: value } }
            }
            aria-current={category === value ? "page" : undefined}
            className={buttonVariants({
              variant: category === value ? "primary" : "outline",
              size: "sm",
            })}
          >
            {NOTIFICATION_LABELS[value]}
          </Link>
        ))}
      </nav>

      {page ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-muted-foreground">
            {unreadCount === null
              ? "Счётчик временно недоступен"
              : `Непрочитанных ${formatNumber(unreadCount)}`}
          </p>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-disabled={pending !== null}
              aria-busy={pending === "reload" || undefined}
              onClick={() => {
                if (pending === null) void reload();
              }}
            >
              {pending === "reload" ? (
                <Spinner aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" className="size-4" />
              )}
              Обновить ленту
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-disabled={pending !== null || unreadCount === 0}
              aria-busy={pending === "all" || undefined}
              onClick={() => {
                if (pending === null) void markAllRead();
              }}
            >
              {pending === "all" ? (
                <Spinner aria-hidden="true" />
              ) : (
                <CheckCheck aria-hidden="true" className="size-4" />
              )}
              Отметить всё прочитанным
            </Button>
          </div>
        </div>
      ) : null}

      {error && page ? (
        <Alert
          tone="danger"
          title="Действие не завершено"
          action={
            <Button
              variant="outline"
              disabled={pending !== null}
              onClick={() => void lastAttempt.current?.()}
            >
              Повторить
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}
      <p
        role="status"
        aria-atomic="true"
        className={notice ? "text-sm text-success-strong" : "sr-only"}
      >
        {notice}
      </p>

      {!page ? (
        <ErrorState
          title="Уведомления не загрузились"
          description={error ?? "Попробуйте загрузить ленту ещё раз. Остальные разделы доступны."}
          onRetry={() => {
            if (pending === null) void reload();
          }}
          retryLabel={pending === "reload" ? "Загружаем…" : "Повторить"}
        />
      ) : page.items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={
            category === "ALL" ? "Уведомлений пока нет" : "В этой категории пока нет уведомлений"
          }
          description={
            category === "ALL"
              ? "Здесь появятся объявления деканата, изменения расписания и статусы ваших заявок."
              : "Посмотрите остальные объявления в общей ленте."
          }
          action={
            <Link
              href={category === "ALL" ? "/" : "/notifications"}
              className={buttonVariants({ variant: "outline" })}
            >
              {category === "ALL" ? "На главную" : "Все уведомления"}
            </Link>
          }
        />
      ) : (
        <>
          <ol aria-label="Лента уведомлений" role="list" className="space-y-3">
            {page.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <NotificationCard
                  item={item}
                  busy={pending !== null}
                  saving={pending === item.id}
                  onRead={() => void markRead(item.id)}
                />
              </li>
            ))}
          </ol>
          {page.nextCursor || loadedMore ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                aria-disabled={!page.nextCursor || pending !== null}
                aria-busy={pending === "more" || undefined}
                onClick={() => {
                  if (pending === null) void loadMore();
                }}
              >
                {pending === "more" ? (
                  <Spinner aria-hidden="true" />
                ) : (
                  <RefreshCw aria-hidden="true" className="size-4" />
                )}
                {page.nextCursor ? "Загрузить ещё" : "Все уведомления загружены"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
