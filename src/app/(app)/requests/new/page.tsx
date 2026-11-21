import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RequestCatalog } from "@/components/requests/request-catalog";
import {
  RequestForm,
  type RequestDiscipline,
  type RequestFormValues,
} from "@/components/requests/request-form";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getRequest, getRequestCatalog } from "@/lib/actions/requests";
import { getCurrentUser } from "@/lib/auth/session";
import { getSemesterOverview, getSemesters } from "@/lib/domain/grades";
import { formatWorkingDays } from "@/lib/format";
import { requestPayloadSchema, requestTypeCodeSchema } from "@/lib/validation/requests";

export const metadata: Metadata = { title: "Новая заявка" };

type NewRequestPageProps = {
  searchParams: Promise<{ type?: string | string[]; repeat?: string | string[] }>;
};

async function getDisciplineOptions(userId: string) {
  const options = new Map<string, RequestDiscipline>();
  try {
    const semesters = await getSemesters(userId);
    const results = await Promise.allSettled(
      semesters.map((semester) => getSemesterOverview(userId, semester.id)),
    );
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      for (const entry of [...result.value.grades, ...result.value.session]) {
        options.set(entry.discipline.id, { id: entry.discipline.id, name: entry.discipline.name });
      }
    }
    return {
      disciplines: [...options.values()].sort((a, b) => a.name.localeCompare(b.name, "ru")),
      unavailable: results.some((result) => result.status === "rejected"),
    };
  } catch {
    return { disciplines: [], unavailable: true };
  }
}

export default async function NewRequestPage({ searchParams }: NewRequestPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Frequests%2Fnew");
  if (user.role !== "STUDENT") redirect("/requests");

  const params = await searchParams;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const repeatId = Array.isArray(params.repeat) ? params.repeat[0] : params.repeat;
  const previous = repeatId ? await getRequest(repeatId) : null;
  if (repeatId && !previous) notFound();
  const type = requestTypeCodeSchema.safeParse(previous?.typeCode ?? rawType);
  if (!type.success) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader title="Новая заявка" description="Выберите тип обращения в деканат." />
        <RequestCatalog />
      </div>
    );
  }
  const initialPayload = previous
    ? requestPayloadSchema.safeParse({ typeCode: previous.typeCode, payload: previous.payload })
    : null;
  const initialValues: Partial<RequestFormValues> | undefined = initialPayload?.success
    ? initialPayload.data.payload
    : undefined;
  const [catalog, { disciplines, unavailable }] = await Promise.all([
    getRequestCatalog(),
    type.data === "RETAKE"
      ? getDisciplineOptions(user.id)
      : { disciplines: [], unavailable: false },
  ]);
  const details = catalog.find((entry) => entry.code === type.data);
  if (!details) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader title="Этот тип заявки недоступен" />
        <Link href="/requests/new" className={buttonVariants({ variant: "outline" })}>
          К каталогу заявок
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl min-w-0 space-y-5 wrap-anywhere sm:space-y-6">
      <Link href="/requests" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft aria-hidden="true" className="size-4" /> Все заявки
      </Link>
      <PageHeader title={details.title} description={details.description} />
      <p className="text-sm font-medium text-foreground">
        Срок подготовки: {formatWorkingDays(details.processingDays)}
      </p>
      {previous ? (
        <Alert tone="info" title="Повторное обращение">
          Поля из заявки № {previous.number} уже заполнены. Проверьте их и внесите исправления перед
          отправкой.
        </Alert>
      ) : null}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <RequestForm
            key={`${type.data}-${previous?.id ?? "new"}`}
            typeCode={type.data}
            initialValues={initialValues}
            disciplines={disciplines}
            disciplinesUnavailable={unavailable}
          />
        </CardContent>
      </Card>
    </div>
  );
}
