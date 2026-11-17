import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm px-2 py-0.5 text-sm leading-5 font-medium whitespace-normal",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-success-muted text-success-strong",
        warning: "bg-warning-muted text-warning-strong",
        danger: "bg-danger-muted text-danger-strong",
        info: "bg-info-muted text-info-strong",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

/** Статус всегда сопровождается текстом: цвет не единственный носитель смысла. */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
