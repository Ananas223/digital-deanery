import type { RequestPayloadInput } from "@/lib/validation/requests";
import { formatDate } from "@/lib/format";

type RequestPayloadViewProps = {
  payload: RequestPayloadInput | null;
  disciplineName?: string | null;
};

/** Поля заявки в человеческом виде: без JSON и внутренних кодов. */
export function RequestPayloadView({ payload, disciplineName }: RequestPayloadViewProps) {
  if (!payload) {
    return <p className="text-sm text-muted-foreground">Данные заявки недоступны.</p>;
  }

  const rows: Array<{ label: string; value: string }> = [];

  switch (payload.typeCode) {
    case "STUDY_CERTIFICATE": {
      const data = payload.payload;
      rows.push({ label: "Место предоставления", value: data.deliveryPlace });
      if (data.comment) {
        rows.push({ label: "Комментарий студента", value: data.comment });
      }
      break;
    }
    case "PLACE_REQUIREMENT": {
      const data = payload.payload;
      rows.push(
        { label: "Организация", value: data.organizationName },
        { label: "Место предоставления", value: data.deliveryPlace },
      );
      if (data.comment) {
        rows.push({ label: "Комментарий студента", value: data.comment });
      }
      break;
    }
    case "ACADEMIC_LEAVE": {
      const data = payload.payload;
      rows.push(
        { label: "Причина", value: data.reason },
        { label: "Дата начала", value: formatDate(data.startDate) },
        { label: "Дата окончания", value: formatDate(data.endDate) },
      );
      if (data.comment) {
        rows.push({ label: "Комментарий студента", value: data.comment });
      }
      break;
    }
    case "RETAKE": {
      const data = payload.payload;
      rows.push(
        { label: "Дисциплина", value: disciplineName ?? "Не найдена" },
        { label: "Причина", value: data.reason },
      );
      if (data.comment) {
        rows.push({ label: "Комментарий студента", value: data.comment });
      }
      break;
    }
  }

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-[minmax(9rem,14rem)_1fr]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
