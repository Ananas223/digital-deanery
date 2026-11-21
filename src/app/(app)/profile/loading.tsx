import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div role="status" aria-label="Загружаем профиль" className="min-w-0 space-y-8">
      <div aria-hidden="true" className="space-y-8">
        <Skeleton className="h-9 w-1/2 sm:w-1/3" />
        <div className="flex items-center gap-4 border-b border-border pb-8">
          <Skeleton className="size-16 shrink-0 rounded-card" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-7 w-4/5 sm:w-1/2" />
            <Skeleton className="h-4 w-1/2 sm:w-1/3" />
          </div>
        </div>
        <div className="max-w-3xl space-y-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <span className="sr-only">Загружаем профиль.</span>
    </div>
  );
}
