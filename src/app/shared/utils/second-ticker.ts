import { DestroyRef, Signal, inject, signal } from '@angular/core';

export function secondTicker(): Signal<number> {
  const now = signal(Date.now());
  const handle = setInterval(() => now.set(Date.now()), 1000);
  inject(DestroyRef).onDestroy(() => clearInterval(handle));
  return now.asReadonly();
}
