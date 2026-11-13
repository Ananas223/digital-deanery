import { cn } from "@/lib/utils";

/**
 * Плейсхолдер загрузки. Декоративен: контейнер, который ждёт данные,
 * должен объявлять состояние (`role="status"` и текстом для скринридера).
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
