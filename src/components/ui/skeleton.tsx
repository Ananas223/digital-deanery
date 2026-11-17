import { cn } from "@/lib/utils";

/**
 * Плейсхолдер загрузки. Декоративен: контейнер, который ждёт данные,
 * должен объявлять состояние (`role="status"` и текстом для скринридера).
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
