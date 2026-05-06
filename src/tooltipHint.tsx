type TooltipHintProps = {
  text: string;
  label?: string;
};

export function TooltipHint({ text, label = "Aide" }: TooltipHintProps) {
  return (
    <span className="tooltip-hint-wrap">
      <button type="button" className="tooltip-hint-btn" aria-label={label}>
        ?
      </button>
      <span role="tooltip" className="tooltip-hint-bubble">
        {text}
      </span>
    </span>
  );
}
