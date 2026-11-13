import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Надзаголовок: дата, раздел или контекст экрана. */
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
};

/** Заголовок страницы: единственный `h1` экрана и необязательные действия. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
