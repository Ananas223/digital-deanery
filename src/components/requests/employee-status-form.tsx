"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { transitionRequestStatus } from "@/lib/actions/requests";
import { REQUEST_STATUS_LABELS } from "@/lib/domain/request-status";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { RequestStatus } from "@/generated/prisma/enums";

type EmployeeStatusFormProps = {
  requestId: string;
  allowedTransitions: RequestStatus[];
};

/** Смена статуса сотрудником: сервер повторно проверяет переход и причину. */
export function EmployeeStatusForm({ requestId, allowedTransitions }: EmployeeStatusFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | "">(
    allowedTransitions[0] ?? "",
  );

  if (allowedTransitions.length === 0 || !selectedStatus) {
    return (
      <Alert tone="info" title="Статус завершён">
        Заявка в конечном статусе. Изменять её дальше нельзя.
      </Alert>
    );
  }

  const requiresReason = selectedStatus === "REJECTED";
  const commentError =
    requiresReason && comment.trim().length === 0 ? "Укажите причину отклонения" : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedStatus) {
      return;
    }

    if (requiresReason && comment.trim().length === 0) {
      setError("Укажите причину отклонения");
      return;
    }

    startTransition(async () => {
      const result = await transitionRequestStatus({
        requestId,
        toStatus: selectedStatus,
        comment: comment.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setComment("");
      toast.add({
        title: "Статус обновлён",
        description: `Заявка переведена в статус «${REQUEST_STATUS_LABELS[selectedStatus]}».`,
      });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert tone="danger" title="Не удалось изменить статус">
          {error}
        </Alert>
      ) : null}

      <Field id="request-status" label="Новый статус" required>
        {(control) => (
          <Select
            {...control}
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value as RequestStatus);
              setError(null);
            }}
            disabled={isPending}
          >
            {allowedTransitions.map((status) => (
              <option key={status} value={status}>
                {REQUEST_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        id="request-comment"
        label={requiresReason ? "Причина отклонения" : "Комментарий"}
        hint={
          requiresReason
            ? "Причина обязательна: студент увидит её в карточке и уведомлении."
            : "Необязательно. Комментарий увидит студент в истории заявки."
        }
        error={commentError}
        required={requiresReason}
      >
        {(control) => (
          <Textarea
            {...control}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            placeholder={
              requiresReason
                ? "Например: не указан полный адрес организации"
                : "Что сделано или что нужно уточнить"
            }
            disabled={isPending}
          />
        )}
      </Field>

      <Button type="submit" loading={isPending} className="w-full sm:w-auto">
        Изменить статус
      </Button>
    </form>
  );
}
