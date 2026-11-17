"use client";

import { ScheduleErrorPanel } from "@/components/schedule/schedule-error-panel";

type ErrorProps = { error: Error & { digest?: string }; reset: () => void };

export default function ScheduleError({ reset }: ErrorProps) {
  return <ScheduleErrorPanel reset={reset} />;
}
