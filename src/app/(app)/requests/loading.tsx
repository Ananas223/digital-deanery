import { Skeleton } from "@/components/ui/skeleton";

export default function RequestsLoading() {
  return (
    <div role="status" aria-label="Загружаем заявки" className="min-w-0 space-y-6">
      <span className="sr-only">Загружаем заявки</span>
      <Skeleton className="h-10 w-48 max-w-full" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-24" />
      </div>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-36 w-full rounded-card" />
      ))}
    </div>
  );
}
