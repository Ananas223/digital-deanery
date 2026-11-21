import { ArrowUpRight, CalendarDays, FileCheck2, FileText, RotateCcw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { REQUEST_TYPE_DETAILS } from "@/components/requests/request-types";
import { REQUEST_TYPE_CODES } from "@/lib/validation/requests";

const TYPE_ICONS = {
  STUDY_CERTIFICATE: FileCheck2,
  PLACE_REQUIREMENT: FileText,
  ACADEMIC_LEAVE: CalendarDays,
  RETAKE: RotateCcw,
} as const;

export function RequestCatalog() {
  return (
    <section id="request-catalog" aria-labelledby="request-catalog-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="request-catalog-heading" className="text-xl font-semibold text-foreground">
          С чего начнём?
        </h2>
        <p className="max-w-prose text-meta text-muted-foreground">
          Выберите обращение. Плановая дата готовности появится после отправки.
        </p>
      </div>
      <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
        {REQUEST_TYPE_CODES.map((code) => {
          const details = REQUEST_TYPE_DETAILS[code];
          const Icon = TYPE_ICONS[code];
          return (
            <li key={code} className="min-w-0">
              <Link
                href={`/requests/new?type=${code}` as Route}
                className="group flex h-full min-w-0 flex-col rounded-card border border-border bg-card p-5 text-foreground shadow-card transition-colors hover:border-ring hover:bg-primary-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-muted"
              >
                <div className="mb-4 flex items-center justify-between gap-3 text-link">
                  <Icon aria-hidden="true" className="size-6" />
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </div>
                <h3 className="text-lg leading-6 font-semibold">{details.title}</h3>
                <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
                  {details.description}
                </p>
                <p className="mt-4 border-t border-border pt-3 text-meta text-muted-foreground">
                  <span className="font-medium text-foreground">Понадобится </span>
                  {details.needed.toLocaleLowerCase("ru-RU")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
