import "server-only";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSemesterLabel, type Semester } from "@/lib/domain/grades";
import { gradesHref, type GradesContext } from "@/lib/ui/grades-query";
import { cn } from "@/lib/utils";

type SemesterSelectorProps = {
  semesters: Semester[];
  context: GradesContext;
  selectedSemesterId?: string;
};

export function GradesSemesterSelector({
  semesters,
  context,
  selectedSemesterId,
}: SemesterSelectorProps) {
  if (semesters.length === 0) return null;

  if (semesters.length > 5) {
    return (
      <search>
        <form action="/grades" method="GET" aria-label="Выбор семестра" className="space-y-2">
          <label htmlFor="grades-semester" className="block text-sm font-medium">
            Семестр
          </label>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
            <select
              id="grades-semester"
              name="semesterId"
              defaultValue={selectedSemesterId ?? ""}
              required
              className="min-h-12 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto sm:max-w-full"
            >
              <option value="" disabled>
                Выберите семестр
              </option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {getSemesterLabel(semester)}
                  {semester.isCurrent ? " · текущий" : ""}
                </option>
              ))}
            </select>
            <input type="hidden" name="tab" value={context.tab} />
            {context.disciplineId ? (
              <input type="hidden" name="disciplineId" value={context.disciplineId} />
            ) : null}
            <Button type="submit" className="min-h-12 sm:shrink-0">
              Показать
            </Button>
          </div>
        </form>
      </search>
    );
  }

  return (
    <nav aria-label="Семестры">
      <ul className="flex min-w-0 flex-wrap gap-2">
        {semesters.map((semester) => {
          const selected = semester.id === selectedSemesterId;
          return (
            <li key={semester.id} className="max-w-full min-w-0">
              <Link
                href={gradesHref({ ...context, semesterId: semester.id })}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 min-w-0 flex-col justify-center gap-0.5 rounded-lg border px-4 py-2 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected
                    ? "border-primary bg-card text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary active:bg-primary-muted",
                )}
              >
                <span className="font-medium">{getSemesterLabel(semester)}</span>
                {semester.isCurrent ? <span>Текущий семестр</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function GradesViewLinks({ context }: { context: GradesContext }) {
  return (
    <nav aria-label="Раздел успеваемости" className="border-b border-border">
      <ul className="flex flex-wrap gap-x-6">
        {(
          [
            { tab: "grades", label: "Оценки" },
            { tab: "session", label: "Сессия" },
          ] as const
        ).map(({ tab, label }) => (
          <li key={tab}>
            <Link
              href={gradesHref({ ...context, tab })}
              aria-current={context.tab === tab ? "page" : undefined}
              className={cn(
                "inline-flex min-h-12 items-center border-b-2 px-1 py-3 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                context.tab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground active:text-primary",
              )}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
