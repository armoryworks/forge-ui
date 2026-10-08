export function elapsedMs(start: string | Date | null | undefined, nowMs: number): number {
  if (!start) return 0;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return 0;
  return Math.max(0, Math.round((nowMs - startMs) / 1000) * 1000);
}
