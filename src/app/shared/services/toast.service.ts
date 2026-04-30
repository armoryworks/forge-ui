import { Injectable, signal } from '@angular/core';

import { isCapabilityDisabledError } from '../errors/capability-disabled.error';

export interface Toast {
  id: number;
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  details?: string;
  autoDismissMs?: number;
  count: number;
}

interface ToastOptions {
  severity: Toast['severity'];
  title: string;
  message?: string;
  details?: string;
  autoDismissMs?: number;
}

const MAX_VISIBLE = 5;
const DEFAULT_DISMISS: Record<Toast['severity'], number | null> = {
  info: 8000,
  success: 8000,
  warning: 12000,
  error: null,
};

let nextId = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(options: ToastOptions): void {
    // Phase 4 Phase-D — capability-gate resilience. Disabled-capability
    // responses are an intentional configuration state, not a user-visible
    // error. The interceptor short-circuits before reaching here, but any
    // future caller that bubbles a `CapabilityDisabledError` into the toast
    // layer should be silently ignored.
    if (this.isCapabilityNoise(options)) {
      return;
    }

    const dismissMs = options.autoDismissMs ?? DEFAULT_DISMISS[options.severity];

    // Deduplicate: if an identical toast (same severity + title + message) already exists, bump its count
    const existing = this._toasts().find(
      (t) => t.severity === options.severity && t.title === options.title && t.message === options.message,
    );
    if (existing) {
      this._toasts.update((list) =>
        list.map((t) => (t.id === existing.id ? { ...t, count: t.count + 1 } : t)),
      );
      return;
    }

    const id = nextId++;
    const toast: Toast = { id, ...options, count: 1 };
    this._toasts.update((list) => {
      const updated = [toast, ...list];
      return updated.length > MAX_VISIBLE ? updated.slice(0, MAX_VISIBLE) : updated;
    });

    if (dismissMs !== null) {
      setTimeout(() => this.dismiss(id), dismissMs);
    }
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /**
   * Returns true when the toast options carry a {@link CapabilityDisabledError}
   * passed through `details` (some upstream error pipelines stash the error
   * object there). Distinct check: also detect a body that looks like the
   * server envelope — first defense in case an older caller forwards a raw
   * 403 capability response to a generic error toast.
   */
  private isCapabilityNoise(options: ToastOptions): boolean {
    const details = options.details as unknown;
    if (isCapabilityDisabledError(details)) return true;
    if (typeof details === 'string'
      && details.includes('"code":"capability-disabled"')) {
      return true;
    }
    return false;
  }
}
