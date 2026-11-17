"use client";

import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { parseScheduleDate, readScheduleSemesterId } from "@/lib/ui/schedule-query";

export function ScheduleReturnLink() {
  const search = useSearchParams();
  const query = new URLSearchParams();
  const view = search.get("view");
  if (view === "day" || view === "week") query.set("view", view);
  for (const key of ["day", "week"] as const) {
    const value = search.get(key);
    if (value && parseScheduleDate(value)) query.set(key, value);
  }
  const semesterId = readScheduleSemesterId(search.get("semesterId") ?? undefined);
  if (semesterId) query.set("semesterId", semesterId);
  const suffix = query.toString();
  const href: Route = suffix ? `/schedule?${suffix}` : "/schedule";
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />К расписанию
    </Link>
  );
}
