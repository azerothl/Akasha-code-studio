import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-none text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--akasha-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--akasha-bg)] disabled:pointer-events-none disabled:opacity-50 shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--akasha-accent)] text-white border border-transparent hover:bg-[var(--akasha-accent-hover)]",
        secondary:
          "border border-[var(--akasha-border)] bg-transparent text-[var(--akasha-text-muted)] hover:border-[var(--akasha-accent)] hover:bg-[var(--akasha-bg-surface-hover)] hover:text-[var(--akasha-text)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--akasha-text-muted)] hover:bg-[var(--akasha-bg-surface-hover)] hover:text-[var(--akasha-text)]",
        danger:
          "border border-[var(--akasha-status-error-accent)] bg-[var(--akasha-status-error-bg)] text-[var(--akasha-status-error-fg)] hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} type={type} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
