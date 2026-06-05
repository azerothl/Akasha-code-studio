import * as React from "react";
import { cn } from "../../lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-none border border-[var(--akasha-border)] bg-[var(--akasha-bg-elevated)] px-3 py-2 text-sm text-[var(--akasha-text)] placeholder:text-[var(--akasha-text-dim)] focus-visible:outline-none focus-visible:border-[var(--akasha-accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
