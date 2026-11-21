import { cn } from "@/lib/utils";

/** Текстовое поле. Размер `min-h-11` (44 px) — минимальная зона нажатия на мобильном. */
export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base leading-6 text-foreground transition-colors duration-(--duration-feedback) ease-interface",
        "placeholder:text-muted-foreground",
        "hover:border-ring",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
        "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger",
        className,
      )}
      {...props}
    />
  );
}
