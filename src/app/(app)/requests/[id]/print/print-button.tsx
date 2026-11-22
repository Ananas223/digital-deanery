"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Печать средствами браузера; кнопка не попадает на бумагу. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden="true" className="size-4" />
      Печать
    </Button>
  );
}
