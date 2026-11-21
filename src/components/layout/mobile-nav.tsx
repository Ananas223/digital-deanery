"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, primaryNav } from "@/components/layout/nav-items";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const mobileLabels: Record<string, string> = {
  "/grades": "Учёба",
  "/notifications": "События",
};

/** Five mobile destinations; unread state adds no extra navigation target. */
export function MobileNav({ unreadCount }: { unreadCount?: number }) {
  const pathname = usePathname();
  const showUnread = unreadCount !== undefined && Number.isFinite(unreadCount) && unreadCount > 0;

  return (
    <nav
      aria-label="Разделы кабинета"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {primaryNav.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          const visibleLabel = mobileLabels[item.href] ?? item.label;
          const hasCount = item.href === "/notifications" && showUnread;

          return (
            <li key={item.label} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0 py-1.5 text-center text-xs leading-4 transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary-muted font-semibold text-link outline-1 -outline-offset-1 outline-selection"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="relative inline-flex shrink-0">
                  <Icon aria-hidden="true" className="size-5" />
                  {hasCount ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 left-3 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground tabular-nums"
                    >
                      {unreadCount > 99 ? "99+" : formatNumber(unreadCount)}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full wrap-anywhere whitespace-normal">
                  {visibleLabel}
                  {visibleLabel !== item.label ? (
                    <span className="sr-only">: {item.label}</span>
                  ) : null}
                </span>
                {hasCount ? (
                  <span className="sr-only">Непрочитанных {formatNumber(unreadCount)}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
