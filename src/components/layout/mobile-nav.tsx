"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, primaryNav } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const mobileLabels: Record<string, string> = {
  "/grades": "Учёба",
  "/notifications": "События",
};

/** Five fixed mobile destinations with full accessible names and 44px+ targets. */
export function MobileNav() {
  const pathname = usePathname();

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

          return (
            <li key={item.label} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0 py-1.5 text-center text-xs leading-4 transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary-muted font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="max-w-full wrap-anywhere whitespace-normal">
                  {visibleLabel}
                  {visibleLabel !== item.label ? (
                    <span className="sr-only">: {item.label}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
