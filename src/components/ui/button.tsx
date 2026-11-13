import { cva, type VariantProps } from "class-variance-authority";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary/60",
        outline: "border border-input bg-card text-foreground hover:bg-muted active:bg-muted/80",
        ghost: "text-foreground hover:bg-muted active:bg-muted/80",
        danger: "bg-danger text-danger-foreground hover:bg-danger/90 active:bg-danger/80",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Блокирует кнопку и показывает спиннер, пока запрос не завершён. */
    loading?: boolean;
  };

/** Кнопка дизайн-системы. Для ссылок используйте `buttonVariants`. */
export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
