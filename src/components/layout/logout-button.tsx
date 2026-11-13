"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOut } from "@/lib/auth/auth-client";

/**
 * Выход из кабинета. Необратимое действие: сначала подтверждение,
 * затем `signOut()` и переход на страницу входа.
 */
export function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (pending && !nextOpen) {
      return;
    }

    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
    }
  }

  async function handleSignOut() {
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const result = await signOut();

      if (result?.error) {
        setError("Не удалось выйти. Проверьте подключение и попробуйте снова.");
        setPending(false);
        return;
      }

      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Сервис временно недоступен. Попробуйте выйти ещё раз через минуту.");
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="md"
        className="min-w-11 px-2 sm:px-3"
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Выйти</span>
        <span className="sr-only sm:hidden">Выйти из кабинета</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выйти из кабинета?</DialogTitle>
            <DialogDescription>
              Сессия завершится на этом устройстве. Чтобы вернуться, снова введите e-mail и пароль.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              Отмена
            </Button>
            <Button variant="danger" loading={pending} onClick={handleSignOut}>
              Выйти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
