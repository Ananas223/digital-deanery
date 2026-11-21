import type { Route } from "next";

export type GradesTab = "grades" | "session";
export type GradesSearchParams = Record<string, string | string[] | undefined>;
export type GradesContext = {
  semesterId?: string;
  disciplineId?: string;
  tab: GradesTab;
};

function readId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 256 ? value : undefined;
}

export function readGradesContext(search: GradesSearchParams): GradesContext & {
  invalidSemester: boolean;
  invalidDiscipline: boolean;
} {
  const semesterId = readId(search.semesterId);
  const disciplineId = readId(search.disciplineId);
  return {
    semesterId,
    disciplineId,
    tab: search.tab === "session" ? "session" : "grades",
    invalidSemester: search.semesterId !== undefined && semesterId === undefined,
    invalidDiscipline: search.disciplineId !== undefined && disciplineId === undefined,
  };
}

export function gradesHref(
  context: GradesContext,
  anchor?: "discipline-detail" | "grades-content",
): Route {
  const query = new URLSearchParams();
  if (context.semesterId) query.set("semesterId", context.semesterId);
  query.set("tab", context.tab);
  if (context.disciplineId) query.set("disciplineId", context.disciplineId);
  return `/grades?${query.toString()}${anchor ? `#${anchor}` : ""}` as Route;
}
