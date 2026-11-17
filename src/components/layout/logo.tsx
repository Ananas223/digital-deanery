import { BookOpen } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** На странице входа логотип не ведёт на главный экран. */
  linked?: boolean;
};

/** Own wordmark and Lucide book; no official university insignia. */
export function Logo({ className, linked = true }: LogoProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="logo-mark flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary bg-card text-primary"
      >
        <BookOpen aria-hidden="true" className="size-5" strokeWidth={1.6} />
      </span>
      <span className="logo-wordmark min-w-0 text-lg leading-6 font-semibold tracking-tight wrap-anywhere text-foreground">
        Цифровой деканат
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
