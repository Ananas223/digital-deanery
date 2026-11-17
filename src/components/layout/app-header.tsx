"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { LogoutButton } from "@/components/layout/logout-button";
import type { ShellUser } from "@/components/layout/types";

/** Mobile masthead; the page supplies its own single heading. */
export function AppHeader({ user }: { user: ShellUser }) {
  const pathname = usePathname();

  return (
    <header className="flex min-h-12 min-w-0 items-center justify-between gap-2 border-b border-border md:hidden">
      <Logo className="gap-0 [&_.logo-mark]:hidden [&_.logo-wordmark]:text-base" />

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/profile"
          aria-label={`Профиль: ${user.name}`}
          aria-current={pathname === "/profile" ? "page" : undefined}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-primary-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <UserRound aria-hidden="true" className="size-5" />
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
