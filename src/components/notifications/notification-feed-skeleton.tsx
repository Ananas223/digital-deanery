import { Skeleton } from "@/components/ui/skeleton";

export function NotificationFeedSkeleton() {
  return (
    <div role="status" aria-label="Загружаем уведомления" className="space-y-4">
      <div aria-hidden="true" className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-20" />
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-28" />
      </div>
      {[0, 1, 2].map((index) => (
        <div key={index} className="space-y-4 rounded-card border border-border bg-card p-4 sm:p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
      <span className="sr-only">Загружаем уведомления.</span>
    </div>
  );
}
