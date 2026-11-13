import { ArrowRight, User, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { primaryNav } from "@/components/layout/nav-items";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate, getFirstName } from "@/lib/format";

export const metadata: Metadata = {
  title: "Главная",
};

type SectionLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

const sections = [
  ...primaryNav.filter((item) => item.href !== "/"),
  {
    href: "/profile",
    label: "Профиль",
    icon: User,
    description: "Личные и академические данные: ФИО, группа, направление и форма обучения.",
  },
] as const satisfies readonly SectionLink[];

/** Главный экран: приветствие и переходы во все разделы кабинета (PRD Ф-00). */
export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Сегодня, ${formatDate(today)}`}
        title={`Здравствуйте, ${getFirstName(user.name)}!`}
        description="Это ваш кабинет: расписание, успеваемость, заявки и уведомления собраны в одном месте."
      />

      <Alert tone="info" title="Кабинет наполняется">
        Вход, навигация и профиль уже работают. Расписание, оценки, заявки и уведомления появятся
        здесь, когда демонстрационная база деканата будет подключена.
      </Alert>

      <section aria-labelledby="sections-heading" className="space-y-3">
        <h2 id="sections-heading" className="text-lg font-semibold tracking-tight">
          Разделы кабинета
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <li key={section.label} className="min-w-0">
                <Link
                  href={section.href}
                  className="group flex h-full flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-ring/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 items-center justify-center rounded-md bg-primary-muted text-primary"
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                    {section.label}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                    />
                  </span>
                  <span className="text-sm text-muted-foreground">{section.description}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
