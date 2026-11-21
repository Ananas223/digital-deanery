"use client";

import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";

type OverviewErrorProps = {
  title: string;
  description: string;
  href?: Route;
  linkLabel?: string;
};

/** Повторяет серверное чтение, сохраняя текущую сессию и остальные разделы. */
export function OverviewError({ title, description, href, linkLabel }: OverviewErrorProps) {
  const router = useRouter();

  return (
    <section aria-label={title} className="min-w-0 space-y-2">
      <ErrorState title={title} description={description} onRetry={() => router.refresh()} />
      {href && linkLabel ? (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 py-2 text-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {linkLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}
