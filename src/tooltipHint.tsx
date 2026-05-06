import { useId } from "react";
import { Button } from "./components/ui/button";

type TooltipHintProps = {
  text: string;
  label?: string;
};

export function TooltipHint({ text, label = "Aide" }: TooltipHintProps) {
  const tooltipId = useId();
  return (
    <span className="tooltip-hint-wrap">
      <Button variant="ghost" size="icon" className="tooltip-hint-btn" aria-label={label} aria-describedby={tooltipId}>
        ?
      </Button>
      <span id={tooltipId} role="tooltip" className="tooltip-hint-bubble">
        {text}
      </span>
    </span>
  );
}
