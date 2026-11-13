import { cva, type VariantProps } from "class-variance-authority";

import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-muted font-semibold text-primary uppercase select-none",
  {
    variants: {
      size: {
        sm: "size-8 text-xs",
        md: "size-10 text-sm",
        lg: "size-14 text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type AvatarProps = React.ComponentProps<"span"> &
  VariantProps<typeof avatarVariants> & {
    name: string;
  };

/**
 * Аватар из инициалов. Декоративен: имя всегда есть рядом в тексте
 * или в доступном описании ссылки.
 */
export function Avatar({ name, size, className, ...props }: AvatarProps) {
  return (
    <span aria-hidden="true" className={cn(avatarVariants({ size }), className)} {...props}>
      {getInitials(name)}
    </span>
  );
}
