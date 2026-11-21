import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getStudentProfile, type StudentProfile } from "@/lib/domain/profile";
import { formatNumber } from "@/lib/format";

import { OverviewError } from "./overview-error";

type StudentOverviewProps = {
  userId: string;
};

/** Личная учебная справка; в браузер не передаётся идентификатор для выбора профиля. */
export async function StudentOverview({ userId }: StudentOverviewProps) {
  let profile: StudentProfile | null;

  try {
    profile = await getStudentProfile(userId);
  } catch {
    return (
      <OverviewError
        title="Учебные сведения не загрузились"
        description="Попробуйте обновить данные. Расписание можно смотреть независимо от этого блока."
        href="/profile"
        linkLabel="Открыть профиль"
      />
    );
  }

  if (!profile) {
    return (
      <EmptyState
        title="Учебные сведения не найдены"
        description="Откройте профиль и обратитесь в деканат, чтобы проверить связь с учебными данными."
        action={
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Открыть профиль
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-center gap-3 border-b border-border pb-4">
        <Avatar name={profile.fullName} size="md" className="rounded-md" />
        <h3 className="min-w-0 text-base leading-snug font-medium text-pretty text-foreground">
          {profile.fullName}
        </h3>
      </div>
      <dl className="space-y-4">
        <div>
          <dt className="text-sm text-muted-foreground">Группа и курс</dt>
          <dd className="mt-1 text-base font-medium text-foreground">
            {profile.group} · {formatNumber(profile.course)} курс
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Факультет</dt>
          <dd className="mt-1 text-sm leading-relaxed text-pretty text-foreground">
            {profile.faculty}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Направление подготовки</dt>
          <dd className="mt-1 text-sm leading-relaxed text-pretty text-foreground">
            {profile.program}
          </dd>
        </div>
      </dl>
      <Link
        href="/profile"
        className="inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-sm font-medium text-link underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        Открыть профиль
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>
    </div>
  );
}

export function StudentOverviewSkeleton() {
  return (
    <div role="status" aria-label="Загружаем учебные сведения" className="space-y-4">
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
      <span className="sr-only">Загружаем учебные сведения.</span>
    </div>
  );
}
