const shownErrors = new WeakSet<object>();

export function markHttpErrorShown(error: object): void {
  shownErrors.add(error);
}

export function wasHttpErrorShown(error: unknown): boolean {
  return typeof error === 'object' && error !== null && shownErrors.has(error);
}
