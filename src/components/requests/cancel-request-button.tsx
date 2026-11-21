"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cancelRequest } from "@/lib/actions/requests";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const toast = useToast();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeOpen(nextOpen: boolean) {
    if (pending) return;
    setOpen(nextOpen);
    setError(null);
  }

  async function confirmCancel() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await cancelRequest(requestId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      toast.add({ title: "Заявка отменена", description: "Отмена сохранена в истории обращения." });
      router.refresh();
    } catch {
      setError("Не удалось отменить заявку. Проверьте подключение и попробуйте снова.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Отменить заявку</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отменить заявку?</DialogTitle>
          <DialogDescription>
            Деканат перестанет обрабатывать это обращение. При необходимости вы сможете создать
            новое.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => changeOpen(false)}>
            Оставить заявку
          </Button>
          <Button variant="danger" loading={pending} onClick={confirmCancel}>
            Отменить заявку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
