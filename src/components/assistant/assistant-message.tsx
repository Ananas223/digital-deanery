import Link from "next/link";
import type { ReactNode } from "react";

import { parseAssistantMarkdown, type InlineNode, type MarkdownBlock } from "./assistant-markdown";

const LINK_CLASS =
  "rounded-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function renderInline(nodes: InlineNode[], onNavigate: () => void): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "strong":
        return <strong key={index}>{node.value}</strong>;
      case "em":
        return <em key={index}>{node.value}</em>;
      case "code":
        return (
          <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
            {node.value}
          </code>
        );
      case "link":
        return (
          <Link
            key={index}
            href={node.href}
            prefetch={false}
            className={LINK_CLASS}
            onClick={(event) => {
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
                onNavigate();
            }}
          >
            {node.label}
          </Link>
        );
      default:
        return node.value;
    }
  });
}

function renderBlock(block: MarkdownBlock, index: number, onNavigate: () => void): ReactNode {
  if (block.kind === "list") {
    return (
      <ul key={index} className="list-disc space-y-1 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item, onNavigate)}</li>
        ))}
      </ul>
    );
  }

  return (
    <p key={index} className="whitespace-pre-wrap">
      {renderInline(block.children, onNavigate)}
    </p>
  );
}

/** Ответ Блика: ограниченный безопасный Markdown без HTML и внешних ссылок. */
export function AssistantMessage({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const blocks = parseAssistantMarkdown(text);

  return (
    <div className="space-y-2 text-sm leading-relaxed wrap-anywhere">
      {blocks.map((block, index) => renderBlock(block, index, onNavigate))}
    </div>
  );
}
