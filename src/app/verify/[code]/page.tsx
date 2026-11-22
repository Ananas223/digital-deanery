import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SkipLink } from "@/components/layout/skip-link";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCertificateVerification } from "@/lib/domain/certificates";
import { formatCourse, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Проверка справки",
  robots: { index: false, follow: false },
};

type VerifyCertificatePageProps = {
  params: Promise<{ code: string }>;
};

function VerificationRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Публичная проверка справки по коду (`US-15`, `A-16`).
 *
 * Страница открывается без сессии. Показывает только разрешённый минимум:
 * ФИО, факультет, направление, курс, группу, дату готовности и статус.
 * Неизвестный код, не-`READY` и не-справочный тип дают одинаковый `notFound()`.
 */
export default async function VerifyCertificatePage({ params }: VerifyCertificatePageProps) {
  const { code } = await params;
  const certificate = await getCertificateVerification(code);

  if (!certificate) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 wrap-anywhere outline-offset-4 sm:px-6 sm:py-12"
      >
        <section className="rounded-card border border-border bg-card p-6 sm:p-10">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Учебный концепт · не официальный документ
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            Справка подтверждена
          </h1>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-pretty text-muted-foreground">
            Запись найдена в учебном концепте «Деканат будущего». Ниже — данные, которые концепт
            показывает получателю справки.
          </p>

          <div className="mt-5 inline-flex min-h-9 items-center rounded-full bg-primary-muted px-3 text-sm font-medium text-success-strong">
            Статус: Готова
          </div>

          <dl className="mt-4">
            <VerificationRow label="ФИО">{certificate.fullName}</VerificationRow>
            <VerificationRow label="Факультет">{certificate.facultyName}</VerificationRow>
            <VerificationRow label="Направление">{certificate.programName}</VerificationRow>
            <VerificationRow label="Курс">{formatCourse(certificate.course)}</VerificationRow>
            <VerificationRow label="Группа">{certificate.groupCode}</VerificationRow>
            <VerificationRow label="Дата готовности">
              <time dateTime={certificate.readyAt.toISOString()}>
                {formatDate(certificate.readyAt)}
              </time>
            </VerificationRow>
          </dl>

          <p className="mt-6 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
            Это учебный концепт для конкурса, а не официальный сервис вуза. Проверка не заменяет
            документ, выданный деканатом.
          </p>
        </section>
      </main>

      <div className="px-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
