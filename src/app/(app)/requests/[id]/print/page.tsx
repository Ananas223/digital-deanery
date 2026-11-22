import { ArrowLeft } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildVerificationUrl,
  getCertificateForOwner,
  type CertificateForOwner,
} from "@/lib/domain/certificates";
import { formatCourse, formatDate, formatDateTime } from "@/lib/format";

import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Печать справки",
  robots: { index: false, follow: false },
};

const CONCEPT_WATERMARK = "КОНЦЕПТ · НЕ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ";

type PrintCertificatePageProps = {
  params: Promise<{ id: string }>;
};

/** Строка реквизита бланка: подпись и значение. */
function CertificateRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium text-foreground">{children}</dd>
    </div>
  );
}

async function renderQrCode(certificate: CertificateForOwner): Promise<string> {
  return QRCode.toDataURL(buildVerificationUrl(certificate.verifyCode), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
}

/**
 * Печатный бланк готовой справки (`US-15`, `P10-IDEA-02`).
 *
 * Доступен только владельцу, только в статусе `READY` и только для типов
 * справок; остальные случаи дают нейтральный `notFound()`. Оболочка кабинета
 * на этом маршруте отключена в `AppShell`.
 */
export default async function PrintCertificatePage({ params }: PrintCertificatePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "STUDENT") {
    notFound();
  }

  const { id } = await params;
  const certificate = await getCertificateForOwner(user.id, id);

  if (!certificate) {
    notFound();
  }

  const qrDataUrl = await renderQrCode(certificate);
  const printedAt = new Date();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl px-4 py-6 outline-offset-4 sm:px-6 print:max-w-none print:p-0"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/requests/${id}` as Route}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />К заявке
        </Link>
        <PrintButton />
      </div>

      <article className="relative overflow-hidden rounded-card border border-border bg-card p-6 sm:p-10 print:rounded-none print:border-0 print:p-0">
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex rotate-[-24deg] items-center justify-center text-center text-lg font-semibold tracking-[0.2em] text-muted-foreground/15 uppercase select-none sm:text-2xl print:text-3xl"
        >
          {CONCEPT_WATERMARK}
        </p>

        <header className="relative border-b border-border pb-5">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Учебный концепт · не официальный документ
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            {certificate.typeTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Номер заявки: {certificate.number}</p>
        </header>

        <dl className="relative mt-2">
          <CertificateRow label="ФИО">{certificate.fullName}</CertificateRow>
          <CertificateRow label="Факультет">{certificate.facultyName}</CertificateRow>
          <CertificateRow label="Направление">{certificate.programName}</CertificateRow>
          <CertificateRow label="Курс">{formatCourse(certificate.course)}</CertificateRow>
          <CertificateRow label="Группа">{certificate.groupCode}</CertificateRow>
          <CertificateRow label="Дата готовности">{formatDate(certificate.readyAt)}</CertificateRow>
        </dl>

        <footer className="relative mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>
              Документ выпущен в учебном концепте «Деканат будущего» и не является официальной
              справкой вуза.
            </p>
            <p>
              Подлинность можно проверить по QR-коду или адресу:{" "}
              <span className="break-all text-foreground">
                {buildVerificationUrl(certificate.verifyCode)}
              </span>
            </p>
            <p>
              Дата печати:{" "}
              <time dateTime={printedAt.toISOString()}>{formatDateTime(printedAt)}</time>
            </p>
          </div>
          <figure className="justify-self-start sm:justify-self-end">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR приходит с сервера как PNG data URL; next/image для data URL не нужен и потребовал бы настройки. */}
            <img
              src={qrDataUrl}
              alt="QR-код для проверки справки"
              width={160}
              height={160}
              className="size-40 rounded-md border border-border bg-white p-2"
            />
            <figcaption className="mt-2 max-w-40 text-caption text-muted-foreground">
              Проверка справки по коду
            </figcaption>
          </figure>
        </footer>
      </article>
    </main>
  );
}
