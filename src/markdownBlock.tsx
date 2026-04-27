import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

function sanitizeMarkdownUrl(url?: string) {
  if (url == null) {
    return undefined;
  }

  const trimmed = url.trim();
  if (trimmed === "") {
    return undefined;
  }

  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return trimmed;
  }

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

const mdComponents: Partial<Components> = {
  a({ href, children, ...rest }) {
    const safeHref = sanitizeMarkdownUrl(href);
    const external = safeHref != null && /^https?:\/\//i.test(safeHref);
    return (
      <a href={safeHref} {...rest} {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
        {children}
      </a>
    );
  },
  img({ alt }) {
    return alt ? <span>[image: {alt}]</span> : null;
  },
};

function flattenNodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenNodeText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return flattenNodeText(props?.children);
  }
  return "";
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~()[\]{}<>]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function withHeadingId(level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"): NonNullable<Partial<Components>[typeof level]> {
  return ({ children, ...rest }) => {
    const raw = flattenNodeText(children);
    const id = slugifyHeading(raw);
    const Tag = level;
    return (
      <Tag id={id || undefined} {...rest}>
        {children}
      </Tag>
    );
  };
}

mdComponents.h1 = withHeadingId("h1");
mdComponents.h2 = withHeadingId("h2");
mdComponents.h3 = withHeadingId("h3");
mdComponents.h4 = withHeadingId("h4");
mdComponents.h5 = withHeadingId("h5");
mdComponents.h6 = withHeadingId("h6");

type MarkdownBlockProps = {
  text: string;
  className?: string;
};

export function MarkdownBlock({ text, className }: MarkdownBlockProps) {
  if (text === "") {
    return null;
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
