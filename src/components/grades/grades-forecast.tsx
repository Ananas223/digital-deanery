import "server-only";

import { Alert, type AlertTone } from "@/components/ui/alert";
import type { SemesterOverview } from "@/lib/domain/grades";
import {
  buildHonorsForecast,
  toForecastGrade,
  type HonorsForecastState,
} from "@/lib/domain/grades-forecast";
import { formatNumber } from "@/lib/format";

const STATE_TONES: Record<HonorsForecastState, AlertTone> = {
  NO_DATA: "info",
  ON_TRACK: "success",
  BELOW_THRESHOLD: "warning",
  IMPOSSIBLE: "danger",
};

const STATE_TITLES: Record<HonorsForecastState, string> = {
  NO_DATA: "Данных пока недостаточно",
  ON_TRACK: "Красный диплом в пределах досягаемости",
  BELOW_THRESHOLD: "Нужно ещё несколько оценок «отлично»",
  IMPOSSIBLE: "Красный диплом недостижим",
};

/**
 * Прогноз красного диплома за выбранный семестр (`Ф-03.9`, `A-15`).
 * Показывает долю «отлично», порог 75 %, нужное число пятёрок или честную
 * причину недостижимости; данные не меняет.
 */
export function GradesForecast({ overview, now }: { overview: SemesterOverview; now: Date }) {
  const forecast = buildHonorsForecast(overview.grades.map(toForecastGrade), {
    semesterEndsAt: overview.semester.endsAt,
    now,
  });
  const shareLabel = forecast.share === null ? "—" : `${Math.round(forecast.share * 100)} %`;
  const thresholdLabel = `${Math.round(forecast.threshold * 100)} %`;

  return (
    <section
      aria-labelledby="grades-forecast"
      className="min-w-0 space-y-4 rounded-card border border-border p-5 wrap-anywhere sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="grades-forecast" className="text-xl font-medium">
          Прогноз красного диплома
        </h2>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Порог — {thresholdLabel} оценок «отлично» среди дисциплин с числовой оценкой. Зачёты и
          дисциплины без оценки в расчёт не входят.
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 space-y-1">
          <dt className="text-sm leading-6 text-muted-foreground">Доля «отлично»</dt>
          <dd className="text-lg leading-7 font-medium tabular-nums">{shareLabel}</dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-sm leading-6 text-muted-foreground">Порог</dt>
          <dd className="text-lg leading-7 font-medium tabular-nums">{thresholdLabel}</dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-sm leading-6 text-muted-foreground">Оценок с числом</dt>
          <dd className="text-lg leading-7 font-medium tabular-nums">
            {formatNumber(forecast.numericCount)}
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-sm leading-6 text-muted-foreground">Из них «отлично»</dt>
          <dd className="text-lg leading-7 font-medium tabular-nums">
            {formatNumber(forecast.excellentCount)}
          </dd>
        </div>
      </dl>
      <Alert tone={STATE_TONES[forecast.state]} title={STATE_TITLES[forecast.state]}>
        <p>{forecast.message}</p>
      </Alert>
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        Допущения: в расчёт входят только оценки 2–5 по дисциплинам с числовым результатом. Зачёты,
        незачёты и дисциплины без оценки не повышают долю «отлично». Прогноз справочный и ничего не
        меняет.
      </p>
    </section>
  );
}
