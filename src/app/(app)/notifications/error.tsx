"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function NotificationsError({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      title="Уведомления не загрузились"
      description="Попробуйте открыть ленту ещё раз. Остальные разделы доступны."
      onRetry={retry}
    />
  );
}
