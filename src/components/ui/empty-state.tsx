import { Inbox, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
};

/** Пустое состояние: объясняет, почему данных нет, и что произойдёт дальше. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-card border border-dashed border-border bg-card/60 p-5 sm:p-6",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
