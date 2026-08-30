import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

interface MfaPasskeyValidateResponse {
  accessToken: string;
  expiresAt: string;
}

interface WireDescriptor {
  type: string;
  id: string;
  transports?: string[];
}

interface WireCreationOptions {
  challenge: string;
  user: { id: string; name: string; displayName: string };
  excludeCredentials?: WireDescriptor[];
  [key: string]: unknown;
}

interface WireRequestOptions {
  challenge: string;
  allowCredentials?: WireDescriptor[];
  [key: string]: unknown;
}

/**
 * Browser side of the WebAuthn ceremonies: fetches options from the server,
 * runs the platform authenticator, and posts the raw response back. Handles
 * the base64url coercion fido2-net-lib's JSON shapes expect.
 */
@Injectable({ providedIn: 'root' })
export class PasskeyService {
  private readonly http = inject(HttpClient);

  supported(): boolean {
    return typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  }

  /** Registers a passkey for the signed-in user (desktop enrollment). */
  async register(deviceName?: string): Promise<string> {
    const options = await firstValueFrom(this.http.post<Record<string, unknown>>(
      `${environment.apiUrl}/auth/passkeys/register/options`, {}));

    const publicKey = PasskeyService.coerceCreationOptions(options);
    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    const response = credential.response as AuthenticatorAttestationResponse;

    const result = await firstValueFrom(this.http.post<{ deviceName: string }>(
      `${environment.apiUrl}/auth/passkeys/register`, {
        deviceName,
        response: {
          id: credential.id,
          rawId: PasskeyService.toB64Url(credential.rawId),
          type: credential.type,
          response: {
            attestationObject: PasskeyService.toB64Url(response.attestationObject),
            clientDataJSON: PasskeyService.toB64Url(response.clientDataJSON),
          },
        },
      }));
    return result.deviceName;
  }

  /**
   * Passkey as the second factor mid-login. `apiBase` overrides the API
   * origin during enrollment (the instance isn't installed yet). Returns
   * null when the user has no passkeys or the assertion fails/cancels —
   * the caller falls back to TOTP.
   */
  async assertForMfa(
    mfaPendingToken: string, apiBase?: string,
  ): Promise<MfaPasskeyValidateResponse | null> {
    const base = apiBase ?? environment.apiUrl;
    let options: Record<string, unknown>;
    try {
      options = await firstValueFrom(this.http.post<Record<string, unknown>>(
        `${base}/auth/passkeys/challenge/options`, { mfaPendingToken }));
    } catch {
      return null;
    }

    try {
      const publicKey = PasskeyService.coerceRequestOptions(options);
      const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
      const response = credential.response as AuthenticatorAssertionResponse;

      return await firstValueFrom(this.http.post<MfaPasskeyValidateResponse>(
        `${base}/auth/passkeys/challenge/validate`, {
          mfaPendingToken,
          response: {
            id: credential.id,
            rawId: PasskeyService.toB64Url(credential.rawId),
            type: credential.type,
            response: {
              authenticatorData: PasskeyService.toB64Url(response.authenticatorData),
              clientDataJSON: PasskeyService.toB64Url(response.clientDataJSON),
              signature: PasskeyService.toB64Url(response.signature),
              userHandle: response.userHandle ? PasskeyService.toB64Url(response.userHandle) : null,
            },
          },
        }));
    } catch {
      return null;
    }
  }

  private static coerceCreationOptions(raw: Record<string, unknown>): PublicKeyCredentialCreationOptions {
    const wire = raw as unknown as WireCreationOptions;
    return {
      ...wire,
      challenge: PasskeyService.fromB64Url(wire.challenge),
      user: { ...wire.user, id: PasskeyService.fromB64Url(wire.user.id) },
      excludeCredentials: (wire.excludeCredentials ?? []).map((c) => ({
        ...c,
        id: PasskeyService.fromB64Url(c.id),
      })),
    } as unknown as PublicKeyCredentialCreationOptions;
  }

  private static coerceRequestOptions(raw: Record<string, unknown>): PublicKeyCredentialRequestOptions {
    const wire = raw as unknown as WireRequestOptions;
    return {
      ...wire,
      challenge: PasskeyService.fromB64Url(wire.challenge),
      allowCredentials: (wire.allowCredentials ?? []).map((c) => ({
        ...c,
        id: PasskeyService.fromB64Url(c.id),
      })),
    } as unknown as PublicKeyCredentialRequestOptions;
  }

  private static toB64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static fromB64Url(value: string): Uint8Array<ArrayBuffer> {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
    const binary = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
}
