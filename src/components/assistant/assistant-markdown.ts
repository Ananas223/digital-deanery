import type { Route } from "next";

/**
 * Разбирает ограниченный Markdown ответа Блика.
 *
 * Поддержаны только `**жирный**`, `*курсив*`, `` `код` ``, маркированные
 * списки и внутренние ссылки кабинета. Неизвестная разметка остаётся текстом:
 * рендер не использует `dangerouslySetInnerHTML`, поэтому HTML из ответа
 * модели не исполняется.
 */

const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|(?<![\w/.:])\/(?:schedule|grades|requests|notifications)(?:\/[a-zA-Z0-9_-]+)?(?:\?[^\s<>()[\] ]+)?(?=$|[\s.,!?;:)\]]))/g;

const BULLET_PATTERN = /^\s*[-*]\s+(.+)$/;

export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "em"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; label: string; href: Route };

export type MarkdownBlock =
  { kind: "paragraph"; children: InlineNode[] } | { kind: "list"; items: InlineNode[][] };

/** Внутренний путь кабинета или `null`, если ссылка не разрешена. */
export function getInternalHref(value: string): Route | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "https://deanery.local");
    const pathExists =
      /^\/(?:schedule|grades|requests|notifications)$/.test(url.pathname) ||
      /^\/(?:schedule|requests)\/[a-zA-Z0-9_-]+$/.test(url.pathname);
    if (url.origin !== "https://deanery.local" || !pathExists) return null;

    return `${url.pathname}${url.search}${url.hash}` as Route;
  } catch {
    return null;
  }
}

function parseLink(label: string, candidate: string): InlineNode {
  const href = getInternalHref(candidate);

  return href ? { kind: "link", label, href } : { kind: "text", value: `[${label}](${candidate})` };
}

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let previousEnd = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index;
    const token = match[0];

    if (start > previousEnd) {
      nodes.push({ kind: "text", value: text.slice(previousEnd, start) });
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push({ kind: "strong", value: token.slice(2, -2) });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push({ kind: "em", value: token.slice(1, -1) });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push({ kind: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)$/);
      nodes.push(link ? parseLink(link[1] ?? "", link[2] ?? "") : { kind: "text", value: token });
    } else {
      const candidate = token.replace(/[.,!?;:]+$/, "");
      const href = getInternalHref(candidate);
      if (href) {
        nodes.push({ kind: "link", label: candidate, href });
        const trailing = token.slice(candidate.length);
        if (trailing) nodes.push({ kind: "text", value: trailing });
      } else {
        nodes.push({ kind: "text", value: token });
      }
    }

    previousEnd = start + token.length;
  }

  if (previousEnd < text.length) {
    nodes.push({ kind: "text", value: text.slice(previousEnd) });
  }

  return nodes;
}

/** Разбирает ответ на абзацы и маркированные списки. */
export function parseAssistantMarkdown(text: string): MarkdownBlock[] {
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph(): void {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", children: parseInline(paragraph.join("\n")) });
      paragraph = [];
    }
  }

  function flushList(): void {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: list.map((item) => parseInline(item)) });
      list = [];
    }
  }

  for (const line of lines) {
    const bullet = line.match(BULLET_PATTERN);

    if (bullet) {
      flushParagraph();
      list.push(bullet[1] ?? "");
      continue;
    }

    flushList();

    if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }

  flushList();
  flushParagraph();

  return blocks;
}
