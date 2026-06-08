type IconName = "bell" | "lock" | "mic" | "paperclip" | "warning" | "menu" | "close" | "chevron-down" | "chevron-right";

type Props = {
  name: IconName;
  className?: string;
};

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MonoIcon({ name, className }: Props) {
  const cls = className ? `mono-icon ${className}` : "mono-icon";
  switch (name) {
    case "bell":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "lock":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <rect x="5" y="11" width="14" height="10" rx="1" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "mic":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
          <path d="M12 18v3" />
        </svg>
      );
    case "paperclip":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      );
    case "warning":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      );
    case "menu":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case "close":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    default:
      return null;
  }
}
