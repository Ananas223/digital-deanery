import Link from "next/link";

import { RouteMark } from "@/components/layout/route-mark";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** На странице входа логотип не ведёт на главный экран. */
  linked?: boolean;
};

/** Own route mark and wordmark; the visible text names the link once. */
export function Logo({ className, linked = true }: LogoProps) {
  const content = (
    <>
      <RouteMark className="logo-mark size-10 text-link" />
      <span className="logo-wordmark min-w-0 text-lg leading-6 font-semibold tracking-tight wrap-anywhere text-foreground">
        Деканат будущего
      </span>
    </>
  );

  if (!linked) {
    return <div className={cn("flex min-w-0 items-center gap-3", className)}>{content}</div>;
  }

  return (
    <Link
      href="/"
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:shrink-0",
        className,
      )}
    >
      {content}
    </Link>
  );
}
