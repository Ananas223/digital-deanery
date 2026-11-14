import { describe, expect, it } from "vitest";

import { sanitizeNextPath } from "@/lib/auth/redirect";

describe("sanitizeNextPath", () => {
  it("принимает внутренние пути с параметрами", () => {
    expect(sanitizeNextPath("/grades")).toBe("/grades");
    expect(sanitizeNextPath("/grades?tab=session")).toBe("/grades?tab=session");
    expect(sanitizeNextPath("/profile#academic")).toBe("/profile#academic");
  });

  it("отклоняет внешние и протокол-относительные адреса", () => {
    expect(sanitizeNextPath("https://example.com")).toBeNull();
    expect(sanitizeNextPath("//example.com")).toBeNull();
    expect(sanitizeNextPath("/%2F%2Fexample.com")).toBeNull();
    expect(sanitizeNextPath("/\\example.com")).toBeNull();
  });

  it("отклоняет страницу входа, чтобы не было цикла", () => {
    expect(sanitizeNextPath("/login")).toBeNull();
    expect(sanitizeNextPath("/login?next=/profile")).toBeNull();
  });

  it("отклоняет пустые, управляющие и слишком длинные значения", () => {
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath(["\/grades"])).toBeNull();
    expect(sanitizeNextPath("")).toBeNull();
    expect(sanitizeNextPath("/grades\nSet-Cookie: x=1")).toBeNull();
    expect(sanitizeNextPath(`/${"a".repeat(2048)}`)).toBeNull();
  });
});
