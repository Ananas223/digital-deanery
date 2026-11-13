"use client";

import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import type { ShellUser } from "@/components/layout/types";
import { ToastProvider } from "@/components/ui/toast";

type AppShellProps = {
  user: ShellUser;
  children: React.ReactNode;
};

/**
 * Оболочка авторизованного кабинета: шапка, боковое меню от `md`,
 * нижняя навигация на мобильном, футер с пометкой о конкурсном концепте.
 */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <SkipLink />
        <AppHeader user={user} />

        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-4 md:px-6 md:py-6">
          <SidebarNav />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
            {children}
          </main>
        </div>

        <div className="pb-20 md:pb-0">
          <SiteFooter />
        </div>

        <MobileNav />
      </div>
    </ToastProvider>
  );
}
