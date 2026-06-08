import * as React from "react";
import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-none border border-[var(--akasha-border)] bg-[var(--akasha-bg-elevated)] px-3 py-2 text-sm text-[var(--akasha-text)] placeholder:text-[var(--akasha-text-dim)] focus-visible:outline-none focus-visible:border-[var(--akasha-accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
