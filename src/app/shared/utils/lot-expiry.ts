/** The expiry a lot received today defaults to: today plus the part's shelf life, or null when it has none. */
export function defaultLotExpiry(shelfLifeDays: number | null | undefined, today = new Date()): Date | null {
  if (!shelfLifeDays || shelfLifeDays <= 0) return null;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + shelfLifeDays);
}
