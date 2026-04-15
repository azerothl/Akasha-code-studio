import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

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
