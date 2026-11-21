"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, primaryNav } from "@/components/layout/nav-items";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Desktop navigation; its routes and order match the mobile navigation. */
export function SidebarNav({ unreadCount }: { unreadCount?: number }) {
  const pathname = usePathname();
  const showUnread = unreadCount !== undefined && Number.isFinite(unreadCount) && unreadCount > 0;

  return (
    <nav aria-label="Разделы кабинета" className="hidden min-w-0 md:block">
      <ul className="space-y-2">
        {primaryNav.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          const hasCount = item.href === "/notifications" && showUnread;

          return (
            <li key={item.label} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-4 py-3 text-sm leading-5 transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary font-semibold text-primary-foreground outline-1 -outline-offset-1 outline-selection"
                    : "text-muted-foreground hover:bg-primary-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 wrap-anywhere">{item.label}</span>
                {hasCount ? (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                        active
                          ? "bg-primary-foreground text-primary-solid"
                          : "bg-primary-muted text-link",
                      )}
                    >
                      {unreadCount > 99 ? "99+" : formatNumber(unreadCount)}
                    </span>
                    <span className="sr-only">Непрочитанных {formatNumber(unreadCount)}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
