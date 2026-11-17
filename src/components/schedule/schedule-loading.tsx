import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export function ScheduleLoading({ detail = false }: { detail?: boolean }) {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">
        {detail ? "Загружаем сведения о занятии" : "Загружаем расписание"}
      </span>
      <PageHeader title={detail ? "Занятие" : "Расписание"} className="border-0 pb-0" />
      {!detail ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-16 min-w-11 flex-1 motion-reduce:animate-none" />
          ))}
        </div>
      ) : null}
      <div className="space-y-4">
        <Skeleton className="h-7 w-2/3 motion-reduce:animate-none" />
        {Array.from({ length: detail ? 1 : 3 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-card border border-border bg-card p-5">
            <Skeleton className="h-5 w-1/3 motion-reduce:animate-none" />
            <Skeleton className="h-7 w-5/6 motion-reduce:animate-none" />
            <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
