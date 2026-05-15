import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-gb-accent/10 text-gb-accent ring-1 ring-gb-accent/25",
        danger: "bg-gb-danger/10 text-gb-danger ring-1 ring-gb-danger/25",
        success: "bg-gb-success/10 text-gb-success ring-1 ring-gb-success/25",
        warning: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/25",
        muted: "bg-white/5 text-gb-muted ring-1 ring-white/10",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
