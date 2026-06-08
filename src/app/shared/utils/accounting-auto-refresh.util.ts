import { DestroyRef, inject } from '@angular/core';

import { AccountingHubService } from '../services/accounting-hub.service';

/**
 * One-liner for the GL accounting screens: subscribe to the backend's `accountingChanged` push and run
 * `reload` on each, with automatic cleanup on component destroy. Call from a component constructor (an
 * injection context). Replaces the manual Refresh button — any GL write anywhere refreshes the screen.
 */
export function autoRefreshOnGlChange(reload: () => void): void {
  const hub = inject(AccountingHubService);
  const destroyRef = inject(DestroyRef);
  const dispose = hub.subscribe(reload);
  destroyRef.onDestroy(dispose);
}
