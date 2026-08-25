import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { Observable, catchError, from, map, of, switchMap } from 'rxjs';

import { EnrollmentQrPayload, ForgeWellKnown, MobileAuthResponse } from '../models/mobile-auth.model';
import { MobileInstance } from '../models/mobile-instance.model';
import { AuthService } from './auth.service';
import { InstanceService } from './instance.service';
import { PlatformService } from './platform.service';

/**
 * Enrollment and device-token refresh for the native shell. The QR path
 * exchanges an admin-issued one-time token; the manual path discovers the
 * instance via /.well-known/forge.json, runs a normal login, then enrolls
 * the device with the resulting session. Refresh rotates the device token;
 * a device-revoked answer wipes this instance and returns to first-run.
 */
@Injectable({ providedIn: 'root' })
export class MobileAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly instances = inject(InstanceService);
  private readonly platform = inject(PlatformService);

  discover(serverUrl: string): Observable<ForgeWellKnown> {
    const origin = MobileAuthService.normalizeOrigin(serverUrl);
    return this.http.get<ForgeWellKnown>(`${origin}/.well-known/forge.json`);
  }

  enrollWithQr(payload: EnrollmentQrPayload): Observable<MobileAuthResponse> {
    const origin = MobileAuthService.normalizeOrigin(payload.server);
    return from(this.deviceProfile()).pipe(
      switchMap((profile) =>
        this.http.post<MobileAuthResponse>(`${origin}/api/v1/devices/enroll`, {
          token: payload.token,
          ...profile,
        })),
      switchMap((response) =>
        from(this.installSession(origin, payload.name, payload.certSha256, response))
          .pipe(map(() => response))),
    );
  }

  /** Manual path, called with the session from a completed phone login. */
  enrollAuthenticated(
    origin: string, instanceName: string, certSha256: string | null, accessToken: string,
  ): Observable<MobileAuthResponse> {
    return from(this.deviceProfile()).pipe(
      switchMap((profile) =>
        this.http.post<MobileAuthResponse>(`${origin}/api/v1/devices/enroll-mine`, profile, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })),
      switchMap((response) =>
        from(this.installSession(origin, instanceName, certSha256, response))
          .pipe(map(() => response))),
    );
  }

  /**
   * Rotates the device refresh token and installs the new access token.
   * Returns the new access token, or null when the session is gone. A
   * device-revoked answer wipes the instance.
   */
  refreshAccessToken(): Observable<string | null> {
    const instance = this.instances.instance();
    if (!instance) return of(null);

    return from(this.instances.getRefreshToken()).pipe(
      switchMap((refreshToken) => {
        if (!refreshToken) return of(null);
        return this.http.post<MobileAuthResponse>(
          `${instance.serverUrl}/api/v1/devices/refresh`,
          { refreshToken, deviceUuid: instance.deviceUuid },
        ).pipe(
          switchMap((response) =>
            from(this.instances.setRefreshToken(response.refreshToken)).pipe(
              map(() => {
                this.auth.setSession(response.accessToken, response.user);
                return response.accessToken;
              }))),
          catchError((error) => {
            if (error?.error?.code === 'device-revoked') {
              return from(this.wipeAndRestart()).pipe(map(() => null));
            }
            return of(null);
          }),
        );
      }),
    );
  }

  async wipeAndRestart(): Promise<void> {
    await this.instances.wipe();
    this.auth.clearAuth();
    await this.router.navigate(['/app/enroll']);
  }

  private async installSession(
    origin: string, name: string, certSha256: string | null, response: MobileAuthResponse,
  ): Promise<void> {
    const instance: MobileInstance = {
      serverUrl: origin,
      name,
      certSha256,
      deviceUuid: await this.instances.getOrCreateDeviceUuid(),
      deviceId: response.deviceId,
      deviceName: response.deviceName,
    };
    await this.instances.setInstance(instance, response.refreshToken);
    this.auth.setSession(response.accessToken, response.user);
  }

  private async deviceProfile(): Promise<{
    deviceUuid: string; deviceName: string; platform: string;
    osVersion: string | null; appVersion: string | null;
  }> {
    const deviceUuid = await this.instances.getOrCreateDeviceUuid();
    let deviceName = 'Phone';
    let osVersion: string | null = null;
    if (this.platform.isNative) {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getInfo();
      deviceName = info.name ?? `${info.manufacturer} ${info.model}`.trim();
      osVersion = info.osVersion ?? null;
    }
    return {
      deviceUuid,
      deviceName,
      platform: this.platform.isIos ? 'ios' : 'android',
      osVersion,
      appVersion: null,
    };
  }

  static normalizeOrigin(input: string): string {
    let value = input.trim();
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw new Error('TLS is required — plain HTTP is refused.');
    }
    return url.origin;
  }
}
