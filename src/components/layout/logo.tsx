import { GraduationCap } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** На странице входа логотип не ведёт на главный экран. */
  linked?: boolean;
};

/** Словесный знак кабинета: собственная иконка, не официальная символика вуза. */
export function Logo({ className, linked = true }: LogoProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <GraduationCap aria-hidden="true" className="size-5" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-foreground">Цифровой деканат</span>
    </>
  );

  if (!linked) {
    return <div className={cn("flex min-w-0 items-center gap-2", className)}>{content}</div>;
  }

  return (
    <Link
      href="/"
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {content}
    </Link>
  );
}
