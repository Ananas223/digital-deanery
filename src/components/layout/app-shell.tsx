"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AssistantProvider } from "@/components/assistant/assistant-provider";
import { AssistantTrigger } from "@/components/assistant/assistant-trigger";
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
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

type AppShellProps = {
  user: ShellUser;
  children: React.ReactNode;
  unreadCount?: number;
  assistantEnabled?: boolean;
};

/** Shared rail on desktop; compact masthead and bottom navigation on mobile. */
export function AppShell({ user, children, unreadCount, assistantEnabled = false }: AppShellProps) {
  const pathname = usePathname();
  const profileActive = isNavItemActive("/profile", pathname);

  return (
    <ToastProvider>
      <AssistantProvider enabled={assistantEnabled}>
        <div className="min-h-dvh md:grid md:grid-cols-[var(--spacing-rail)_minmax(0,1fr)]">
          <SkipLink />
          <EntranceMark />

          <aside
            aria-label="Кабинет студента"
            className="sticky top-0 hidden h-dvh min-w-0 flex-col overflow-y-auto border-r border-border bg-card px-4 pt-6 pb-4 md:flex"
          >
            <Logo className="mx-2" />
            <div className="mt-10">
              <SidebarNav unreadCount={unreadCount} />
              {assistantEnabled ? (
                <div className="mt-3">
                  <AssistantTrigger placement="sidebar" />
                </div>
              ) : null}
            </div>

            <div className="mt-auto pt-8">
              <div className="space-y-2 border-t border-border pt-4">
                <Link
                  href="/profile"
                  aria-current={profileActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors duration-(--duration-feedback) ease-interface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    profileActive
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-foreground hover:bg-primary-muted active:bg-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      profileActive
                        ? "bg-primary-foreground text-primary-solid"
                        : "bg-primary-muted text-link",
                    )}
                  >
                    {getInitials(user.name)}
                  </span>
                  <span>Профиль</span>
                </Link>
                <p className="px-4 text-meta text-muted-foreground">{user.name}</p>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1 [&>button]:w-full [&>button]:justify-start [&>button]:px-4">
                    <LogoutButton />
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-h-dvh min-w-0 flex-col px-4 pb-bottom-safe md:px-shell-gutter md:pb-0">
            <AppHeader user={user} />

            <main
              id="main-content"
              tabIndex={-1}
              className="min-w-0 flex-1 pt-2 outline-offset-4 md:pt-8"
            >
              {children}
            </main>

            <SiteFooter />
          </div>

          <MobileNav unreadCount={unreadCount} />
        </div>
      </AssistantProvider>
    </ToastProvider>
  );
}
