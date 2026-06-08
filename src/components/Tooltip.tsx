import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  safePolygon,
} from "@floating-ui/react";
import { useState, type ReactNode } from "react";

type Placement = "top" | "bottom" | "left" | "right";

type Props = {
  content: ReactNode;
  children: ReactNode;
  placement?: Placement;
  /** When true, wraps children with an info "?" button instead of using children as trigger. */
  info?: boolean;
  className?: string;
};

export function Tooltip({ content, children, placement = "top", info = false, className }: Props) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  });

  const hover = useHover(context, {
    move: false,
    handleClose: safePolygon(),
  });
  const focus = useFocus(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, role]);

  return (
    <span className={`akasha-tooltip-wrap${className ? ` ${className}` : ""}`} data-open={open ? "true" : undefined}>
      {info ? (
        <button
          type="button"
          ref={refs.setReference}
          className="akasha-tooltip-trigger"
          aria-label="?"
          {...getReferenceProps()}
        >
          ?
        </button>
      ) : (
        <span ref={refs.setReference} {...getReferenceProps()} style={{ display: "inline-flex" }}>
          {children}
        </span>
      )}
      {open && content ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={`akasha-tooltip-bubble akasha-tooltip-bubble--${placement}`}
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      ) : null}
      {info ? children : null}
    </span>
  );
}

/** Compact info icon with tooltip — replaces static hint paragraphs. */
export function InfoTip({ label, content }: { label?: string; content: ReactNode }) {
  return (
    <Tooltip content={content} info placement="top">
      {label ? <span className="sr-only">{label}</span> : null}
    </Tooltip>
  );
}
