"use client";

import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";

type OverviewErrorProps = {
  title: string;
  description: string;
};

/** Повторяет серверное чтение, сохраняя текущую сессию и остальные разделы. */
export function OverviewError({ title, description }: OverviewErrorProps) {
  const router = useRouter();

  return <ErrorState title={title} description={description} onRetry={() => router.refresh()} />;
}
