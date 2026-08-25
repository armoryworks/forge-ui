import { Injectable, inject, signal } from '@angular/core';

import { MobileInstance } from '../models/mobile-instance.model';
import { SecureStorageService } from './secure-storage.service';
import { TokenStorageService } from './token-storage.service';

const INSTANCE_KEY = 'forge-mobile-instance';
const REFRESH_KEY = 'forge-mobile-refresh';
const DEVICE_UUID_KEY = 'forge-mobile-device-uuid';
const DEVICE_TOKEN_KEY = 'forge-mobile-device-token';

/**
 * Holds the native shell's enrolled instance: server origin, pinned cert
 * fingerprint, device identity, and the rotating refresh token — all in
 * secure storage. Hydrated by the app initializer before the router starts.
 */
@Injectable({ providedIn: 'root' })
export class InstanceService {
  private readonly secureStorage = inject(SecureStorageService);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly _instance = signal<MobileInstance | null>(null);
  readonly instance = this._instance.asReadonly();

  /** Shared-device credential, in memory after init; never in localStorage on a device. */
  private deviceToken: string | null = null;

  async init(): Promise<void> {
    await this.tokenStorage.hydrate();
    const raw = await this.secureStorage.getItem(INSTANCE_KEY);
    if (raw) {
      try {
        this._instance.set(JSON.parse(raw) as MobileInstance);
      } catch {
        this._instance.set(null);
      }
    }
    this.deviceToken = await this.secureStorage.getItem(DEVICE_TOKEN_KEY);
  }

  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  async setSharedInstance(instance: MobileInstance, deviceToken: string): Promise<void> {
    this._instance.set(instance);
    this.deviceToken = deviceToken;
    await this.secureStorage.setItem(INSTANCE_KEY, JSON.stringify(instance));
    await this.secureStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
  }

  async setInstance(instance: MobileInstance, refreshToken: string): Promise<void> {
    this._instance.set(instance);
    await this.secureStorage.setItem(INSTANCE_KEY, JSON.stringify(instance));
    await this.secureStorage.setItem(REFRESH_KEY, refreshToken);
  }

  async setRefreshToken(refreshToken: string): Promise<void> {
    await this.secureStorage.setItem(REFRESH_KEY, refreshToken);
  }

  getRefreshToken(): Promise<string | null> {
    return this.secureStorage.getItem(REFRESH_KEY);
  }

  /**
   * The device's stable identity, minted on first use and kept across
   * re-enrollments so the server reclaims the same device row.
   */
  async getOrCreateDeviceUuid(): Promise<string> {
    const existing = await this.secureStorage.getItem(DEVICE_UUID_KEY);
    if (existing) return existing;
    const uuid = crypto.randomUUID();
    await this.secureStorage.setItem(DEVICE_UUID_KEY, uuid);
    return uuid;
  }

  /** Removes the instance and its credentials — the remote-wipe/unenroll path. */
  async wipe(): Promise<void> {
    this._instance.set(null);
    await this.secureStorage.removeItem(INSTANCE_KEY);
    await this.secureStorage.removeItem(REFRESH_KEY);
    await this.secureStorage.removeItem(DEVICE_TOKEN_KEY);
    this.deviceToken = null;
    this.tokenStorage.remove('forge-token');
    this.tokenStorage.remove('forge-user');
  }
}
