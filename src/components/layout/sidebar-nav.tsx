"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, primaryNav } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/** Desktop navigation; its routes and order match the mobile navigation. */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Разделы кабинета" className="hidden min-w-0 md:block">
      <ul className="space-y-2">
        {primaryNav.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;

          return (
            <li key={item.label} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-4 py-3 text-sm leading-5 transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:bg-primary-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 wrap-anywhere">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
