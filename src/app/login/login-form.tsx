"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/auth-client";

/** Те же правила, что проверяет сервер: одна схема для формы и действия. */
const loginSchema = z.object({
  email: z.email("Введите e-mail в формате name@example.ru"),
  password: z.string().min(8, "Пароль не короче 8 символов"),
});

type LoginValues = z.infer<typeof loginSchema>;

const NEUTRAL_ERROR = "Не удалось войти. Проверьте e-mail и пароль.";
const NETWORK_ERROR = "Сервис временно недоступен. Проверьте подключение и повторите попытку.";

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const result = await signIn.email({ email: values.email, password: values.password });

      if (result?.error) {
        setFormError(NEUTRAL_ERROR);
        // Сообщение нейтрально и не раскрывает, существует ли логин (PRD Ф-01.1).
        setValue("password", "");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setFormError(NETWORK_ERROR);
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

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
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.ru"
            {...control}
            {...register("email")}
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
              autoComplete="current-password"
              placeholder="Введите пароль"
              className="pr-12"
              {...control}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        )}
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Войти
      </Button>
    </form>
  );
}
