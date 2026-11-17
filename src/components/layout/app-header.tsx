"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { LogoutButton } from "@/components/layout/logout-button";
import type { ShellUser } from "@/components/layout/types";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Mobile masthead; the page supplies its own single heading. */
export function AppHeader({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const home = pathname === "/";

  return (
    <header className="flex min-h-12 min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border md:hidden">
      <Logo className="flex-1 basis-40 gap-2 [&_.logo-mark]:size-8 [&_.logo-wordmark]:text-sm [&_.logo-wordmark]:leading-tight" />

      <div className="ms-auto flex shrink-0 items-center gap-1">
        <Link
          href="/profile"
          aria-label={`${getInitials(user.name)} Профиль: ${user.name}`}
          aria-current={pathname === "/profile" ? "page" : undefined}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-(--duration-feedback) ease-interface hover:bg-primary-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-muted",
            home ? "rounded-full bg-primary-muted text-link" : "text-foreground",
          )}
        >
          {home ? (
            <span aria-hidden="true" className="text-sm font-semibold">
              {getInitials(user.name)}
            </span>
          ) : (
            <UserRound aria-hidden="true" className="size-5" />
          )}
        </Link>
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
