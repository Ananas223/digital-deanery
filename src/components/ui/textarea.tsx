import { cn } from "@/lib/utils";

/** Многострочное поле: комментарий к заявке, пояснение и другие длинные тексты. */
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-colors",
        "placeholder:text-muted-foreground",
        "hover:border-ring/60",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
