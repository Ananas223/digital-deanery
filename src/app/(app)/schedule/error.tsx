"use client";

import { ScheduleErrorPanel } from "@/components/schedule/schedule-error-panel";
import { ErrorBoundaryReporter } from "@/components/ui/error-boundary-reporter";
import { useErrorRetry } from "@/components/ui/use-error-retry";

export default function ScheduleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useErrorRetry(reset);

  return (
    <>
      <ErrorBoundaryReporter digest={error.digest} />
      <ScheduleErrorPanel onRetry={retry} />
    </>
  );
}
