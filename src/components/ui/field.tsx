import { cn } from "@/lib/utils";

/**
 * Свойства, которые `Field` передаёт элементу управления:
 * id для связи с подписью и aria-атрибуты для подсказки и ошибки.
 */
export type FieldControl = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
};

type FieldProps = {
  id: string;
  label: string;
  /** Пояснение под полем: формат данных, требования к паролю. */
  hint?: string;
  /** Текст ошибки рядом с полем. Одновременно включает `aria-invalid`. */
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: FieldControl) => React.ReactNode;
};

/**
 * Поле формы с подписью, подсказкой и ошибкой.
 * `children` — функция, чтобы id и aria-атрибуты нельзя было связать неправильно.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger-strong">
            *
          </span>
        ) : null}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}

      {hint ? (
        <p id={hintId} className="text-sm leading-6 text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm leading-6 text-danger-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
