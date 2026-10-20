/** The record id in a route or query param when it is a whole number above zero, otherwise `null`. */
export function parsePositiveId(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
