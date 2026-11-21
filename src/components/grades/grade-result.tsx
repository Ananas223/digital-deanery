import "server-only";

import { getGradeStatusLabel, type GradeEntry } from "@/lib/domain/grades";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GradeResult({ result }: { result: Pick<GradeEntry, "score" | "status"> | null }) {
  const status = result?.status ?? "NOT_GRADED";
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-baseline gap-x-2 gap-y-1",
        status === "FAILED"
          ? "text-danger-strong"
          : status === "PASSED"
            ? "text-link"
            : "text-muted-foreground",
      )}
    >
      {result?.score !== null && result?.score !== undefined ? (
        <span className="font-semibold tabular-nums">{formatNumber(result.score)} из 5</span>
      ) : null}
      <span>{getGradeStatusLabel(status)}</span>
    </span>
  );
}
