import { Card, CardContent } from "@/components/ui/card";

const README_DEMO_URL =
  "https://github.com/Ananas223/digital-deanery/blob/main/README.md#демо-аккаунты";

/**
 * Компактный демонстрационный доступ для жюри (PRD Ф-01.7).
 *
 * Логины и пароль намеренно не дублируются в коде: они описаны в README
 * (`AGENTS.md` § 4.2), поэтому блок ведёт к разделу с демо-аккаунтами.
 */
export function DemoAccess() {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <p className="text-sm font-medium text-foreground">Демонстрационный доступ</p>
        <p className="text-sm text-pretty text-muted-foreground">
          Для жюри доступны два студенческих аккаунта. Логины и пароль опубликованы в{" "}
          <a
            href={README_DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            README, раздел «Демо-аккаунты»
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
