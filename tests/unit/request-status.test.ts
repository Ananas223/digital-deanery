import { describe, expect, it } from "vitest";

import {
  canTransition,
  getAllowedTransitions,
  isTerminalStatus,
  REQUEST_STATUS_LABELS,
} from "@/lib/domain/request-status";
import type { RequestStatus } from "@/generated/prisma/enums";

const STUDENT_OWNER = { role: "STUDENT", isOwner: true } as const;
const STUDENT_FOREIGN = { role: "STUDENT", isOwner: false } as const;
const EMPLOYEE = { role: "DEAN_EMPLOYEE", isOwner: false } as const;

describe("REQUEST_STATUS_LABELS", () => {
  it("подписывает все пять статусов", () => {
    expect(REQUEST_STATUS_LABELS).toEqual({
      NEW: "Новая",
      IN_PROGRESS: "В работе",
      READY: "Готова",
      REJECTED: "Отклонена",
      CANCELLED: "Отменена",
    });
  });
});

describe("canTransition", () => {
  it("разрешает сотруднику взять новую заявку в работу", () => {
    expect(canTransition("NEW", "IN_PROGRESS", EMPLOYEE)).toBe(true);
  });

  it("запрещает сотруднику отклонять или завершать новую заявку", () => {
    expect(canTransition("NEW", "READY", EMPLOYEE)).toBe(false);
    expect(canTransition("NEW", "REJECTED", EMPLOYEE)).toBe(false);
    expect(canTransition("NEW", "CANCELLED", EMPLOYEE)).toBe(false);
  });

  it("разрешает сотруднику завершить или отклонить заявку в работе", () => {
    expect(canTransition("IN_PROGRESS", "READY", EMPLOYEE)).toBe(true);
    expect(canTransition("IN_PROGRESS", "REJECTED", EMPLOYEE)).toBe(true);
  });

  it("запрещает возврат в NEW и отмену из работы", () => {
    expect(canTransition("IN_PROGRESS", "NEW", EMPLOYEE)).toBe(false);
    expect(canTransition("IN_PROGRESS", "CANCELLED", EMPLOYEE)).toBe(false);
  });

  it("разрешает владельцу отменить только новую заявку", () => {
    expect(canTransition("NEW", "CANCELLED", STUDENT_OWNER)).toBe(true);
    expect(canTransition("IN_PROGRESS", "CANCELLED", STUDENT_OWNER)).toBe(false);
  });

  it("запрещает студенту отменять чужую заявку", () => {
    expect(canTransition("NEW", "CANCELLED", STUDENT_FOREIGN)).toBe(false);
  });

  it("запрещает студенту действия сотрудника", () => {
    expect(canTransition("NEW", "IN_PROGRESS", STUDENT_OWNER)).toBe(false);
    expect(canTransition("IN_PROGRESS", "READY", STUDENT_OWNER)).toBe(false);
    expect(canTransition("IN_PROGRESS", "REJECTED", STUDENT_OWNER)).toBe(false);
  });

  it.each(["READY", "REJECTED", "CANCELLED"] as RequestStatus[])(
    "не выпускает из терминального статуса %s",
    (status) => {
      for (const to of ["NEW", "IN_PROGRESS", "READY", "REJECTED", "CANCELLED"] as RequestStatus[]) {
        expect(canTransition(status, to, EMPLOYEE)).toBe(false);
        expect(canTransition(status, to, STUDENT_OWNER)).toBe(false);
      }
    },
  );

  it("запрещает переход в тот же статус", () => {
    expect(canTransition("NEW", "NEW", EMPLOYEE)).toBe(false);
    expect(canTransition("NEW", "NEW", STUDENT_OWNER)).toBe(false);
  });
});

describe("getAllowedTransitions", () => {
  it("перечисляет доступные переходы сотрудника", () => {
    expect(getAllowedTransitions("NEW", EMPLOYEE)).toEqual(["IN_PROGRESS"]);
    expect(getAllowedTransitions("IN_PROGRESS", EMPLOYEE)).toEqual(["READY", "REJECTED"]);
  });

  it("перечисляет доступные переходы владельца", () => {
    expect(getAllowedTransitions("NEW", STUDENT_OWNER)).toEqual(["CANCELLED"]);
    expect(getAllowedTransitions("READY", STUDENT_OWNER)).toEqual([]);
  });
});

describe("isTerminalStatus", () => {
  it("считает готовую, отклонённую и отменённую заявку терминальными", () => {
    expect(isTerminalStatus("READY")).toBe(true);
    expect(isTerminalStatus("REJECTED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
    expect(isTerminalStatus("NEW")).toBe(false);
    expect(isTerminalStatus("IN_PROGRESS")).toBe(false);
  });
});
