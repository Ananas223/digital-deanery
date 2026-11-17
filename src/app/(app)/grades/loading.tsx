import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function GradesLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем успеваемость"
      className="min-w-0 space-y-6 sm:space-y-8"
    >
      <PageHeader title="Успеваемость" />
      <Skeleton className="h-12 w-full sm:w-2/3" />
      <Skeleton className="h-44 w-full" />
      <div className="space-y-4 border-t border-border pt-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
