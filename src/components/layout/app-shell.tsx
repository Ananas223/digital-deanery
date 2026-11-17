"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { EntranceMark } from "@/components/layout/entrance-mark";
import { Logo } from "@/components/layout/logo";
import { LogoutButton } from "@/components/layout/logout-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { isNavItemActive } from "@/components/layout/nav-items";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import type { ShellUser } from "@/components/layout/types";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type AppShellProps = {
  user: ShellUser;
  children: React.ReactNode;
};

/** Shared rail on desktop; compact masthead and bottom navigation on mobile. */
export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const profileActive = isNavItemActive("/profile", pathname);

  return (
    <ToastProvider>
      <div className="min-h-dvh md:grid md:grid-cols-[var(--spacing-rail)_minmax(0,1fr)]">
        <SkipLink />
        <EntranceMark />

        <aside
          aria-label="Кабинет студента"
          className="sticky top-0 hidden h-dvh min-w-0 flex-col overflow-y-auto border-r border-border bg-card px-5 pt-8 pb-5 md:flex"
        >
          <Logo className="mx-2" />
          <div className="mt-14">
            <SidebarNav />
          </div>

          <div className="mt-auto pt-10">
            <div className="space-y-2 border-t border-border pt-4">
              <Link
                href="/profile"
                aria-label={`Профиль: ${user.name}`}
                aria-current={profileActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  profileActive
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-foreground hover:bg-primary-muted",
                )}
              >
                <UserRound aria-hidden="true" className="size-4 shrink-0" />
                <span>Профиль</span>
              </Link>
              <p className="px-4 text-sm leading-6 text-muted-foreground">{user.name}</p>
              <div className="[&>button]:w-full [&>button]:justify-start [&>button]:px-4">
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col px-4 pb-bottom-safe md:px-shell-gutter md:pb-0">
          <AppHeader user={user} />

          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 pt-3 outline-offset-4 md:pt-9"
          >
            {children}
          </main>

          <SiteFooter />
        </div>

        <MobileNav />
      </div>
    </ToastProvider>
  );
}
