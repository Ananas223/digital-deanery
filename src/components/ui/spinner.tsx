import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = React.ComponentProps<"span"> & {
  /** Текст для скринридера. Без него спиннер считается декоративным. */
  label?: string;
};

/** Индикатор загрузки. Внутри кнопок используется без подписи: состояние передаёт `aria-busy`. */
export function Spinner({ className, label, ...props }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
