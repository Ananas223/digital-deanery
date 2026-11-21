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
        "flex min-w-0 flex-col items-start gap-4 rounded-card border border-border bg-card p-4 sm:p-6",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 space-y-1.5">
        <h2 className="text-lg leading-6 font-semibold text-foreground">{title}</h2>
        <p className="max-w-prose text-base leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="min-w-0 pt-1">{action}</div> : null}
    </div>
  );
}
