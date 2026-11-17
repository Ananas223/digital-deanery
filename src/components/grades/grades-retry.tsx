"use client";

import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";

export function GradesRetry({
  title = "Не удалось загрузить успеваемость",
  description = "Попробуйте ещё раз. Выбранные семестр, раздел и дисциплина сохранятся.",
}: {
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  return <ErrorState title={title} description={description} onRetry={() => router.refresh()} />;
}
