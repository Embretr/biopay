import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-brand-foreground",
        success: "border-transparent bg-green-500/20 text-green-400 border-green-500/30",
        error: "border-transparent bg-red-500/20 text-red-400 border-red-500/30",
        warning: "border-transparent bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        pending: "border-transparent bg-blue-500/20 text-blue-400 border-blue-500/30",
        outline: "border-[#1e1e2e] text-[#e2e8f0]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
