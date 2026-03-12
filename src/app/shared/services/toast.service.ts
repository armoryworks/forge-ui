import { Injectable, signal } from '@angular/core';

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
}
