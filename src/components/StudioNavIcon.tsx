const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type Props = {
  id: string;
  className?: string;
};

export function StudioNavIcon({ id, className }: Props) {
  const cls = className ? `mono-icon ${className}` : "mono-icon";
  switch (id) {
    case "project":
    case "project-dashboard":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M7 8h10M7 12h6" />
        </svg>
      );
    case "project-settings":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2" />
        </svg>
      );
    case "development":
    case "dev-editor":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M16 18 22 12 16 6M8 6 2 12l6 6" />
        </svg>
      );
    case "dev-kanban":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <rect x="3" y="4" width="5" height="16" />
          <rect x="10" y="4" width="5" height="10" />
          <rect x="17" y="4" width="4" height="14" />
        </svg>
      );
    case "dev-preview":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "dev-build":
    case "ops-logs":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      );
    case "dev-branches":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <circle cx="6" cy="6" r="2" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="12" r="2" />
          <path d="M6 8v8M8 6h5a4 4 0 0 1 4 4v2" />
        </svg>
      );
    case "design-planning":
    case "design":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M3 3h7l2 2h9v14H3z" />
          <path d="M12 11v6M9 14h6" />
        </svg>
      );
    case "plan":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "operations":
    case "ops-cockpit":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "help":
    case "help-docs":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "help-agents":
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <rect x="4" y="8" width="16" height="12" rx="1" />
          <circle cx="9" cy="13" r="1" />
          <circle cx="15" cy="13" r="1" />
          <path d="M9 17h6M12 8V5M8 5h8" />
        </svg>
      );
    default:
      return (
        <svg className={cls} {...svgProps} aria-hidden>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
