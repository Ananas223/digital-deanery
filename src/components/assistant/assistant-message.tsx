import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

const LINK_PATTERN =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|(?<![\w/.:])\/(?:schedule|grades|requests|notifications)(?:\/[a-zA-Z0-9_-]+)?(?:\?[^\s<>()[\]]+)?(?=$|[\s.,!?;:)\]])/g;

function getInternalHref(value: string): Route | null {
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

/** The response remains plain text, with only known cabinet routes made interactive. */
export function AssistantMessage({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const content: ReactNode[] = [];
  let previousEnd = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index;
    content.push(text.slice(previousEnd, start));
    const candidate = match[2] ?? match[0].replace(/[.,!?;:]+$/, "");
    const label = match[1] ?? candidate;
    const href = getInternalHref(candidate);
    content.push(
      href ? (
        <Link
          key={start}
          href={href}
          prefetch={false}
          className="rounded-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate();
          }}
        >
          {label}
        </Link>
      ) : (
        match[0]
      ),
    );
    if (!match[2] && href) content.push(match[0].slice(candidate.length));
    previousEnd = start + match[0].length;
  }
  content.push(text.slice(previousEnd));
  return <div className="text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">{content}</div>;
}
