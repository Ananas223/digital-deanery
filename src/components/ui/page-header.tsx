import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Необязательный контекст экрана; выводится после заголовка. */
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Собирает заголовок и действия в одну переносимую строку, пояснение — ниже. */
  compact?: boolean;
};

/** Заголовок страницы: единственный `h1` экрана и необязательные действия. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  compact = false,
}: PageHeaderProps) {
  if (compact) {
    return (
      <header className={cn("min-w-0 space-y-1.5", className)}>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1.5">
          <h1 className="min-w-0 text-page-title text-balance">{title}</h1>
          {actions ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {eyebrow ? <p className="text-meta text-muted-foreground">{eyebrow}</p> : null}
        {description ? (
          <p className="max-w-prose text-meta text-muted-foreground">{description}</p>
        ) : null}
      </header>
    );
  }

  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <h1 className="text-page-title text-balance">{title}</h1>
        {eyebrow ? <p className="text-meta text-muted-foreground">{eyebrow}</p> : null}
        {description ? (
          <p className="max-w-prose text-base leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
