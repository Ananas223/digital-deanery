import type { RequestStatus } from "@/generated/prisma/enums";

import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABELS } from "@/lib/domain/request-status";

const STATUS_VARIANTS = {
  NEW: "info",
  IN_PROGRESS: "warning",
  READY: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
} as const;

/** Статус с текстом: цвет — подсказка, смысл всегда в подписи. */
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}
