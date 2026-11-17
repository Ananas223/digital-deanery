import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONES: Record<AlertTone, { container: string; icon: string; Icon: LucideIcon }> = {
  info: { container: "border-info/25 bg-info-muted/70", icon: "text-info-strong", Icon: Info },
  success: {
    container: "border-success/25 bg-success-muted/70",
    icon: "text-success-strong",
    Icon: CircleCheck,
  },
  warning: {
    container: "border-warning/35 bg-warning-muted/80",
    icon: "text-warning-strong",
    Icon: TriangleAlert,
  },
  danger: {
    container: "border-danger/30 bg-danger-muted/70",
    icon: "text-danger-strong",
    Icon: CircleAlert,
  },
};

type AlertProps = {
  tone?: AlertTone;
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** Встроенное сообщение об успехе, ошибке или пояснение. Не требует всплывающего окна. */
export function Alert({ tone = "info", title, action, className, children }: AlertProps) {
  const { container, icon, Icon } = TONES[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex min-w-0 flex-wrap items-start gap-3 rounded-lg border p-4 text-sm leading-6",
        container,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <div className="text-pretty text-foreground">{children}</div>
      </div>
      {action ? <div className="min-w-0">{action}</div> : null}
    </div>
  );
}
