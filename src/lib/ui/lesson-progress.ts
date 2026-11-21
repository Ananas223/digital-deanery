export type LessonProgressValue = {
  value: number;
  durationMs: number;
  elapsedMs: number;
  durationMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
};

/** Display math over effective UTC timestamps; never resolves or changes schedule data. */
export function getLessonProgress(
  startsAt: number,
  endsAt: number,
  now: number,
): LessonProgressValue | null {
  if (![startsAt, endsAt, now].every(Number.isFinite)) return null;
  const durationMs = endsAt - startsAt;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

  const elapsedMs = Math.min(durationMs, Math.max(0, now - startsAt));
  const durationMinutes = durationMs / 60_000;
  return {
    value: elapsedMs / durationMs,
    durationMs,
    elapsedMs,
    durationMinutes,
    elapsedMinutes: elapsedMs === durationMs ? durationMinutes : Math.floor(elapsedMs / 60_000),
    remainingMinutes: Math.ceil((durationMs - elapsedMs) / 60_000),
  };
}
