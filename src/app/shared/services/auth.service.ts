import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SsoProvider } from '../models/sso-provider.model';
import { LinkedSsoProvider } from '../models/linked-sso-provider.model';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  initials: string | null;
  avatarColor: string | null;
  roles: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface SetupStatusResponse {
  setupRequired: boolean;
}

export interface SetupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CompleteSetupRequest {
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _token = signal<string | null>(this.loadToken());
  private readonly _user = signal<AuthUser | null>(this.loadUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  hasRole(role: string): boolean {
    return this._user()?.roles.includes(role) ?? false;
  }

  hasAnyRole(roles: string[]): boolean {
    const userRoles = this._user()?.roles ?? [];
    return roles.some(r => userRoles.includes(r));
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((response) => {
          this._token.set(response.token);
          this._user.set(response.user);
          localStorage.setItem('qbe-token', response.token);
          localStorage.setItem('qbe-user', JSON.stringify(response.user));
        }),
      );
  }

  checkSetupStatus(): Observable<SetupStatusResponse> {
    return this.http.get<SetupStatusResponse>(`${environment.apiUrl}/auth/status`);
  }

  setup(data: SetupRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/setup`, data)
      .pipe(
        tap((response) => {
          this._token.set(response.token);
          this._user.set(response.user);
          localStorage.setItem('qbe-token', response.token);
          localStorage.setItem('qbe-user', JSON.stringify(response.user));
        }),
      );
  }

  completeSetup(data: CompleteSetupRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/complete-setup`, data)
      .pipe(
        tap((response) => {
          this._token.set(response.token);
          this._user.set(response.user);
          localStorage.setItem('qbe-token', response.token);
          localStorage.setItem('qbe-user', JSON.stringify(response.user));
        }),
      );
  }

  setPin(pin: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/set-pin`, { pin });
  }

  kioskLogin(barcode: string, pin: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/kiosk-login`, { barcode, pin })
      .pipe(
        tap((response) => {
          this._token.set(response.token);
          this._user.set(response.user);
          localStorage.setItem('qbe-token', response.token);
          localStorage.setItem('qbe-user', JSON.stringify(response.user));
        }),
      );
  }

  getSsoProviders(): Observable<SsoProvider[]> {
    return this.http.get<SsoProvider[]>(`${environment.apiUrl}/auth/sso/providers`).pipe(
      catchError(() => of([])),
    );
  }

  ssoLogin(provider: string): void {
    window.location.href = `${environment.apiUrl}/auth/sso/${provider}/login`;
  }

  handleSsoToken(token: string): void {
    this._token.set(token);
    localStorage.setItem('qbe-token', token);
    // Fetch user profile from /me endpoint to populate user signal
    this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (user) => {
        this._user.set(user);
        localStorage.setItem('qbe-user', JSON.stringify(user));
      },
    });
  }

  getLinkedSsoProviders(): Observable<LinkedSsoProvider[]> {
    return this.http.get<LinkedSsoProvider[]>(`${environment.apiUrl}/auth/sso/linked`);
  }

  unlinkSso(provider: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/auth/sso/unlink/${provider}`);
  }

  logout(): void {
    this.clearAuth();
    this._broadcastLogout?.();
  }

  clearAuth(): void {
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem('qbe-token');
    localStorage.removeItem('qbe-user');
  }

  /** Set by BroadcastService to avoid circular dependency. */
  private _broadcastLogout?: () => void;

  /** @internal Used by BroadcastService to register the broadcast callback. */
  registerBroadcastCallback(fn: () => void): void {
    this._broadcastLogout = fn;
  }

  private loadToken(): string | null {
    return localStorage.getItem('qbe-token');
  }

  private loadUser(): AuthUser | null {
    const raw = localStorage.getItem('qbe-user');
    return raw ? JSON.parse(raw) : null;
  }
}
