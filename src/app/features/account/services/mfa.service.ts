import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';
import {
  MfaSetupResponse,
  MfaChallengeResponse,
  MfaValidateRequest,
  MfaValidateResponse,
  MfaStatus,
  MfaRecoveryCodesResponse,
  MfaComplianceUser,
  MfaPolicy,
} from '../models/mfa.model';

@Injectable({ providedIn: 'root' })
export class MfaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly _status = signal<MfaStatus | null>(null);

  readonly status = this._status.asReadonly();

  // ── User MFA Setup ──

  beginSetup(deviceName?: string): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${environment.apiUrl}/auth/mfa/setup`, { deviceName });
  }

  verifySetup(deviceId: number, code: string): Observable<{ verified: boolean }> {
    return this.http.post<{ verified: boolean }>(`${environment.apiUrl}/auth/mfa/verify-setup`, { deviceId, code }).pipe(
      switchMap((result) => result.verified
        ? this.auth.refreshAccessToken().pipe(map(() => result))
        : of(result)),
    );
  }

  disable(): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/auth/mfa/disable`).pipe(
      tap(() => this._status.set(null)),
    );
  }

  removeDevice(deviceId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/auth/mfa/devices/${deviceId}`);
  }

  getStatus(): Observable<MfaStatus> {
    return this.http.get<MfaStatus>(`${environment.apiUrl}/auth/mfa/status`).pipe(
      tap(status => this._status.set(status)),
    );
  }

  generateRecoveryCodes(): Observable<MfaRecoveryCodesResponse> {
    return this.http.post<MfaRecoveryCodesResponse>(`${environment.apiUrl}/auth/mfa/recovery-codes`, {});
  }

  // ── MFA Login Flow (unauthenticated) ──

  createChallenge(mfaPendingToken: string): Observable<MfaChallengeResponse> {
    return this.http.post<MfaChallengeResponse>(`${environment.apiUrl}/auth/mfa/challenge`, { mfaPendingToken });
  }

  validateChallenge(request: MfaValidateRequest): Observable<MfaValidateResponse> {
    return this.http.post<MfaValidateResponse>(`${environment.apiUrl}/auth/mfa/validate`, request);
  }

  validateRecovery(challengeToken: string, recoveryCode: string): Observable<MfaValidateResponse> {
    return this.http.post<MfaValidateResponse>(`${environment.apiUrl}/auth/mfa/recovery`, { challengeToken, recoveryCode });
  }

  // ── Admin MFA Policy ──

  getCompliance(): Observable<MfaComplianceUser[]> {
    return this.http.get<MfaComplianceUser[]>(`${environment.apiUrl}/admin/mfa/compliance`);
  }

  getPolicy(): Observable<MfaPolicy> {
    return this.http.get<MfaPolicy>(`${environment.apiUrl}/admin/mfa/policy`);
  }

  setPolicy(requiredRoles: string[]): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/admin/mfa/policy`, { requiredRoles });
  }
}
