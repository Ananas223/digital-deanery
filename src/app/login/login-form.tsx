"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/auth-client";

const loginSchema = z.object({
  email: z.email("Введите e-mail в формате name@example.ru"),
  password: z.string().min(8, "Пароль не короче 8 символов"),
});

type LoginValues = z.infer<typeof loginSchema>;

const NEUTRAL_ERROR = "Не удалось войти. Проверьте e-mail и пароль.";
const RATE_LIMIT_ERROR = "Слишком много попыток входа. Попробуйте позже.";
const SERVICE_ERROR = "Сервис входа временно недоступен. Попробуйте ещё раз позже.";
const NETWORK_ERROR = "Сервис временно недоступен. Проверьте подключение и повторите попытку.";

type LoginFormProps = {
  /** Проверенный внутренний путь для возврата после входа (PRD Ф-01.2). */
  nextPath?: string | null;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const submissionInFlight = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [authPending, setAuthPending] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const emailField = register("email");
  const passwordField = register("password");
  const busy = isSubmitting || authPending || redirecting;
  const hasFieldErrors = Boolean(errors.email || errors.password);

  const onSubmit = async (values: LoginValues) => {
    if (submissionInFlight.current) {
      return;
    }

    submissionInFlight.current = true;
    setAuthPending(true);
    setFormError(null);
    let signedIn = false;

    try {
      const result = await signIn.email({ email: values.email, password: values.password });

      if (result?.error) {
        const status = result.error.status;

        if (status === 429) {
          setFormError(RATE_LIMIT_ERROR);
          return;
        }

        if (status === 408 || status <= 0 || status >= 500) {
          setFormError(SERVICE_ERROR);
          return;
        }

        setFormError(NEUTRAL_ERROR);
        setValue("password", "");
        setFocus("password");
        return;
      }

      signedIn = true;
      setRedirecting(true);
      router.replace((nextPath ?? "/") as Route);
      router.refresh();
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      if (!signedIn) {
        submissionInFlight.current = false;
        setAuthPending(false);
      }
    }
  };

  return (
    <form
      method="post"
      noValidate
      aria-labelledby="login-heading"
      aria-busy={busy}
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      className="space-y-6"
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      {hasFieldErrors ? (
        <Alert tone="danger" title="Проверьте поля">
          <ul className="space-y-1">
            {errors.email ? (
              <li>
                <button
                  type="button"
                  onClick={() => setFocus("email")}
                  className="min-h-11 rounded-sm text-left underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {errors.email.message}
                </button>
              </li>
            ) : null}
            {errors.password ? (
              <li>
                <button
                  type="button"
                  onClick={() => setFocus("password")}
                  className="min-h-11 rounded-sm text-left underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {errors.password.message}
                </button>
              </li>
            ) : null}
          </ul>
        </Alert>
      ) : null}

      <Field
        id="login-email"
        label="E-mail"
        required
        hint="Адрес, указанный в вашем профиле."
        error={errors.email?.message}
      >
        {(control) => (
          <Input
            type="email"
            required
            autoComplete="username"
            inputMode="email"
            enterKeyHint="next"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="name@example.ru"
            className="min-h-12"
            {...control}
            aria-invalid={Boolean(errors.email)}
            {...emailField}
            onChange={(event) => {
              void emailField.onChange(event);
              if (errors.email && loginSchema.shape.email.safeParse(event.target.value).success) {
                clearErrors("email");
              }
            }}
          />
        )}
      </Field>

      <Field
        id="login-password"
        label="Пароль"
        required
        hint="Не менее 8 символов."
        error={errors.password?.message}
      >
        {(control) => (
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="current-password"
              enterKeyHint="go"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Введите пароль"
              className="min-h-12 pr-14"
              {...control}
              aria-invalid={Boolean(errors.password)}
              {...passwordField}
              onChange={(event) => {
                void passwordField.onChange(event);
                if (
                  errors.password &&
                  loginSchema.shape.password.safeParse(event.target.value).success
                ) {
                  clearErrors("password");
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              aria-pressed={showPassword}
              aria-controls="login-password"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-primary-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-5" />
              ) : (
                <Eye aria-hidden="true" className="size-5" />
              )}
            </button>
          </div>
        )}
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {redirecting ? "Открываем кабинет…" : busy ? "Входим…" : "Войти"}
        {!busy ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
      </Button>
      <p role="status" className="sr-only">
        {redirecting ? "Вход выполнен. Открываем кабинет." : busy ? "Выполняется вход." : ""}
      </p>
    </form>
  );
}
