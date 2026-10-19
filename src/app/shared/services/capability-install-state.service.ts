import { Injectable, signal } from '@angular/core';

/**
 * Phase 4 Phase-E — Per-install bootstrap state for the capability onboarding
 * banner. Per 4E-decisions-log #6, the banner is per-install (not per-user):
 * once the install owner has either applied a preset OR run discovery, the
 * banner stays dismissed for everyone. Re-showing it on a per-user basis
 * would be inappropriate — the install IS configured once that's happened.
 *
 * The server is authoritative: the capability descriptor's
 * `onboardingComplete` flag turns true once any preset has been applied or
 * any discovery run recorded, and the banner then stays hidden for every
 * user. This service only records an explicit "skip for now" dismissal,
 * kept in localStorage, which hides the banner in this browser before the
 * install has been configured.
 *
 * The banner does NOT block — users can use the app while it's visible.
 */
@Injectable({ providedIn: 'root' })
export class CapabilityInstallStateService {
  private static readonly STORAGE_KEY = 'forge:capability-onboarding-dismissed';

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
