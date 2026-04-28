import { Injectable, signal } from '@angular/core';

/**
 * Phase 4 Phase-E — UI-only consultant-mode flag (per 4E-decisions-log #1
 * and #7). When `true`, surfaces additional capability-admin affordances:
 *   • Capability codes (`CAP-MD-CUSTOMERS`) shown alongside friendly names.
 *   • Additional consultant-tier discovery questions and inline capability
 *     impact blocks (Phase F when the discovery flow lands).
 *
 * Persisted to localStorage so the same browser session keeps the toggle
 * across reloads. Per 4E-decisions-log #7, the flag is purely a UX hint —
 * the API surface does not change behaviour based on it.
 *
 * Default: `false` (self-serve mode). Toggleable from the capability admin
 * list page header.
 */
@Injectable({ providedIn: 'root' })
export class ConsultantModeService {
  private static readonly STORAGE_KEY = 'qb-engineer:consultant-mode';

  private readonly _enabled = signal<boolean>(this.readFromStorage());

  /** Reactive read of the current mode flag. */
  readonly enabled = this._enabled.asReadonly();

  /** Toggle the flag. Persists to localStorage. */
  toggle(): void {
    this.set(!this._enabled());
  }

  /** Set the flag explicitly. */
  set(value: boolean): void {
    this._enabled.set(value);
    try {
      if (value) localStorage.setItem(ConsultantModeService.STORAGE_KEY, '1');
      else localStorage.removeItem(ConsultantModeService.STORAGE_KEY);
    } catch {
      // localStorage may be unavailable in some sandboxes — silently fall back
      // to in-memory state.
    }
  }

  private readFromStorage(): boolean {
    try {
      return localStorage.getItem(ConsultantModeService.STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
