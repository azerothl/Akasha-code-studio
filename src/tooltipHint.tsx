import { useId } from "react";

type TooltipHintProps = {
  text: string;
  label?: string;
};

export function TooltipHint({ text, label = "Aide" }: TooltipHintProps) {
  const tooltipId = useId();
  return (
    <span className="tooltip-hint-wrap">
      <button type="button" className="tooltip-hint-btn" aria-label={label} aria-describedby={tooltipId}>
        ?
      </button>
      <span id={tooltipId} role="tooltip" className="tooltip-hint-bubble">
        {text}
      </span>
    </span>
  );
}
