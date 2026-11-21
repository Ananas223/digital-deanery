"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function NotificationsError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Уведомления не загрузились"
      description="Попробуйте открыть ленту ещё раз. Остальные разделы доступны."
      onRetry={reset}
    />
  );
}
