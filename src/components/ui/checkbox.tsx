import * as React from "react";
import { cn } from "../../lib/utils";

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, type = "checkbox", ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-4 w-4 rounded-none border border-[var(--akasha-border)] bg-[var(--akasha-bg-elevated)] align-middle accent-[var(--akasha-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--akasha-accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
