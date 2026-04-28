import { Injectable, signal } from '@angular/core';

/**
 * Phase 4 Phase-E — Per-install bootstrap state for the capability onboarding
 * banner. Per 4E-decisions-log #6, the banner is per-install (not per-user):
 * once the install owner has either applied a preset OR run discovery, the
 * banner stays dismissed for everyone. Re-showing it on a per-user basis
 * would be inappropriate — the install IS configured once that's happened.
 *
 * Phase E's contract: the banner is shown when the install is in the
 * default-bootstrapped state and dismissable by the user clicking either
 * "Run discovery" (lands in Phase F) or "Apply preset" (lands in Phase G),
 * or by an explicit "Skip for now" dismissal that records the dismissal
 * locally. Phase E's dismissal lives in localStorage as a per-install flag
 * (the localStorage key includes the install's identity if available); when
 * Phase F/G land, the actual server-side state (preset_applied / discovery_
 * completed) becomes the authoritative source and the localStorage key is
 * cleared.
 *
 * The banner does NOT block — users can use the app while it's visible.
 */
@Injectable({ providedIn: 'root' })
export class CapabilityInstallStateService {
  private static readonly STORAGE_KEY = 'qb-engineer:capability-onboarding-dismissed';

  private readonly _dismissed = signal<boolean>(this.readFromStorage());

  /** Reactive read of whether the banner has been dismissed for this install. */
  readonly dismissed = this._dismissed.asReadonly();

  /** Mark the banner as dismissed. Persists to localStorage. */
  dismiss(): void {
    this._dismissed.set(true);
    try {
      localStorage.setItem(CapabilityInstallStateService.STORAGE_KEY, '1');
    } catch {
      // ignore — graceful fallback to in-memory state
    }
  }

  /**
   * Reset dismissal — used by tests, and reserved for the eventual server-
   * side source once Phase F / G land.
   */
  reset(): void {
    this._dismissed.set(false);
    try {
      localStorage.removeItem(CapabilityInstallStateService.STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private readFromStorage(): boolean {
    try {
      return localStorage.getItem(CapabilityInstallStateService.STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
