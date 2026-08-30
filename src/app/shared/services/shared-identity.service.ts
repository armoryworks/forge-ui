import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, tap } from 'rxjs';

import { AuthService, LoginResponse } from './auth.service';

const IDLE_CLEAR_MS = 60_000;

/**
 * Per-transaction identity on a shared device: a badge scan plus PIN
 * (scan-login) installs a short session for attribution; it clears when the
 * transaction completes or after 60 idle seconds, whichever comes first.
 */
@Injectable({ providedIn: 'root' })
export class SharedIdentityService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _identifiedAt = signal<number | null>(null);
  readonly identified = computed(() => this._identifiedAt() !== null && this.auth.isAuthenticated());
  readonly person = this.auth.user;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  identify(scanValue: string, pin: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/v1/auth/scan-login', { scanValue, pin }).pipe(
      tap((response) => {
        this.auth.setSession(response.token, response.user);
        this._identifiedAt.set(Date.now());
        this.touch();
      }),
    );
  }

  /** Extends the 60-second idle window — call on activity mid-transaction. */
  touch(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.clear(), IDLE_CLEAR_MS);
  }

  /** Ends the transaction: the person's session leaves the device. */
  clear(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this._identifiedAt() === null) return;
    this._identifiedAt.set(null);
    this.auth.clearAuth();
  }
}
