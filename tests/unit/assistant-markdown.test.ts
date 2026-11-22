import { describe, expect, it } from "vitest";

import {
  getInternalHref,
  parseAssistantMarkdown,
  type InlineNode,
} from "@/components/assistant/assistant-markdown";

function inline(text: string): InlineNode[] {
  const [block] = parseAssistantMarkdown(text);
  if (!block || block.kind !== "paragraph") throw new Error("Ожидался абзац");
  return block.children;
}

describe("parseAssistantMarkdown", () => {
  it("рендерит жирный текст и не оставляет сырые звёздочки", () => {
    expect(inline("Это **важно**.")).toEqual([
      { kind: "text", value: "Это " },
      { kind: "strong", value: "важно" },
      { kind: "text", value: "." },
    ]);
  });

  it("рендерит курсив", () => {
    expect(inline("Это *курсив*.")).toEqual([
      { kind: "text", value: "Это " },
      { kind: "em", value: "курсив" },
      { kind: "text", value: "." },
    ]);
  });

  it("рендерит код", () => {
    expect(inline("Откройте `npm run test`.")).toEqual([
      { kind: "text", value: "Откройте " },
      { kind: "code", value: "npm run test" },
      { kind: "text", value: "." },
    ]);
  });

  it("разбирает маркированный список", () => {
    expect(parseAssistantMarkdown("- Первый\n- **Второй**")).toEqual([
      {
        kind: "list",
        items: [[{ kind: "text", value: "Первый" }], [{ kind: "strong", value: "Второй" }]],
      },
    ]);
  });

  it("делает внутреннюю ссылку интерактивной", () => {
    expect(inline("Открыть [расписание](/schedule?view=week)")).toEqual([
      { kind: "text", value: "Открыть " },
      { kind: "link", label: "расписание", href: "/schedule?view=week" },
    ]);
  });

  it("оставляет внутренний путь ссылкой и сохраняет знак препинания", () => {
    expect(inline("Подробнее — /requests.")).toEqual([
      { kind: "text", value: "Подробнее — " },
      { kind: "link", label: "/requests", href: "/requests" },
      { kind: "text", value: "." },
    ]);
  });

  it("не исполняет HTML и оставляет его текстом", () => {
    expect(inline('<script>alert("xss")</script>')).toEqual([
      { kind: "text", value: '<script>alert("xss")</script>' },
    ]);
  });

  it("не делает ссылкой javascript: и внешний URL", () => {
    expect(inline("[плохо](javascript:alert(1))")).toEqual([
      { kind: "text", value: "[плохо](javascript:alert(1)" },
      { kind: "text", value: ")" },
    ]);
    expect(inline("[сайт](https://example.com)")).toEqual([
      { kind: "text", value: "[сайт](https://example.com)" },
    ]);
  });

  it("оставляет неизвестную разметку текстом", () => {
    expect(inline("__не поддержано__ и # заголовок")).toEqual([
      { kind: "text", value: "__не поддержано__ и # заголовок" },
    ]);
  });
});

describe("getInternalHref", () => {
  it("разрешает только известные разделы кабинета", () => {
    expect(getInternalHref("/schedule")).toBe("/schedule");
    expect(getInternalHref("/requests/abc_123?tab=history")).toBe("/requests/abc_123?tab=history");
    expect(getInternalHref("/admin")).toBeNull();
    expect(getInternalHref("//evil.example/schedule")).toBeNull();
    expect(getInternalHref("javascript:alert(1)")).toBeNull();
  });
});
