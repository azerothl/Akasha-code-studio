import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const mdComponents: Partial<Components> = {
  a({ href, children, ...rest }) {
    const external = href != null && /^https?:\/\//i.test(href);
    return (
      <a href={href} {...rest} {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
        {children}
      </a>
    );
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
