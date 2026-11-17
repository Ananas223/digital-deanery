import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Необязательный контекст экрана; выводится после заголовка. */
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
};

/** Заголовок страницы: единственный `h1` экрана и необязательные действия. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <h1 className="text-page-title font-semibold tracking-tight text-balance">{title}</h1>
        {eyebrow ? <p className="text-sm leading-6 text-muted-foreground">{eyebrow}</p> : null}
        {description ? (
          <p className="max-w-prose text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
