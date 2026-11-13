import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { LogoutButton } from "@/components/layout/logout-button";
import { getRoleLabel } from "@/components/layout/role-label";
import type { ShellUser } from "@/components/layout/types";
import { Avatar } from "@/components/ui/avatar";

/** Шапка кабинета: словесный знак, профиль и выход. */
export function AppHeader({ user }: { user: ShellUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Logo />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/profile"
            aria-label={`Профиль: ${user.name}`}
            className="flex min-h-11 min-w-11 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-2"
          >
            <Avatar name={user.name} size="sm" />
            <span className="hidden min-w-0 flex-col text-left sm:flex">
              <span className="max-w-40 truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="max-w-40 truncate text-xs text-muted-foreground">
                {getRoleLabel(user.role)}
              </span>
            </span>
          </Link>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
