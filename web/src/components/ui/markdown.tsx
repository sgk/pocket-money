import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type MarkdownProps = {
  content: string;
  className?: string;
};

const normalizeMarkdown = (content: string) => {
  let value = content.replace(/\\n/g, "\n");
  value = value.replace(/([^\n])\s---(?=\s|#)/g, "$1\n\n---\n\n");
  value = value.replace(/([^\n])\s(#{1,6})(?=\s)/g, "$1\n\n$2");
  return value;
};

export const Markdown = ({ content, className }: MarkdownProps) => (
  <div className={cn("text-sm leading-relaxed", className)}>
    <ReactMarkdown
      components={{
        h1: ({ children, ...props }) => (
          <h1 className="text-base font-semibold mt-4 first:mt-0" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="text-sm font-semibold mt-4 first:mt-0" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="text-sm font-medium mt-3 first:mt-0" {...props}>
            {children}
          </h3>
        ),
        p: ({ children, ...props }) => (
          <p className="mt-2 first:mt-0" {...props}>
            {children}
          </p>
        ),
        strong: ({ children, ...props }) => (
          <strong className="font-semibold" {...props}>
            {children}
          </strong>
        ),
        em: ({ children, ...props }) => (
          <em className="italic" {...props}>
            {children}
          </em>
        ),
        ul: ({ children, ...props }) => (
          <ul className="mt-2 list-disc pl-5 space-y-1" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="mt-2 list-decimal pl-5 space-y-1" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => (
          <li {...props}>{children}</li>
        ),
      }}
    >
      {normalizeMarkdown(content)}
    </ReactMarkdown>
  </div>
);
