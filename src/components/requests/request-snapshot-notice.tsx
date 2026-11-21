"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RequestSnapshotNotice() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Alert
      title="Статус заявки обновляется"
      action={
        <Button
          variant="outline"
          loading={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          {pending ? "Обновляем карточку…" : "Обновить карточку"}
        </Button>
      }
    >
      Попробуйте обновить карточку. Пока статус не загрузится, изменить или отменить заявку нельзя.
    </Alert>
  );
}
