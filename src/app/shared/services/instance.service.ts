import { Injectable, computed, inject, signal } from '@angular/core';

import { MobileInstance } from '../models/mobile-instance.model';
import { SecureStorageService } from './secure-storage.service';
import { TokenStorageService } from './token-storage.service';

const INSTANCES_KEY = 'forge-mobile-instances';
const ACTIVE_KEY = 'forge-mobile-active-instance';
const LEGACY_INSTANCE_KEY = 'forge-mobile-instance';
const LEGACY_REFRESH_KEY = 'forge-mobile-refresh';
const LEGACY_DEVICE_TOKEN_KEY = 'forge-mobile-device-token';
const DEVICE_UUID_KEY = 'forge-mobile-device-uuid';

/**
 * The shell's enrolled instances. Every instance keeps its own credentials
 * under a namespaced secure-storage key (refresh token or shared-device
 * credential); nothing crosses between instances. One instance is active
 * at a time; switching swaps the API origin and session. Hydrated by the
 * app initializer before the router starts.
 */
@Injectable({ providedIn: 'root' })
export class InstanceService {
  private readonly secureStorage = inject(SecureStorageService);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly _instances = signal<MobileInstance[]>([]);
  readonly instances = this._instances.asReadonly();

  private readonly _activeId = signal<string | null>(null);
  readonly instance = computed(() =>
    this._instances().find((i) => i.id === this._activeId()) ?? null);

  private deviceToken: string | null = null;

  async init(): Promise<void> {
    await this.tokenStorage.hydrate();
    await this.migrateLegacy();

    const raw = await this.secureStorage.getItem(INSTANCES_KEY);
    if (raw) {
      try {
        this._instances.set(JSON.parse(raw) as MobileInstance[]);
      } catch {
        this._instances.set([]);
      }
    }
    this._activeId.set(await this.secureStorage.getItem(ACTIVE_KEY));

    const active = this.instance();
    this.deviceToken = active?.shared
      ? await this.secureStorage.getItem(InstanceService.deviceTokenKey(active.id))
      : null;
  }

  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  static idFor(serverUrl: string): string {
    return serverUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
  }

  /** Adds (or replaces) a personal-device instance and makes it active. */
  async setInstance(instance: MobileInstance, refreshToken: string): Promise<void> {
    await this.upsert(instance);
    await this.secureStorage.setItem(InstanceService.refreshKey(instance.id), refreshToken);
    await this.activate(instance.id);
  }

  /** Adds (or replaces) a shared-device instance and makes it active. */
  async setSharedInstance(instance: MobileInstance, deviceToken: string): Promise<void> {
    await this.upsert(instance);
    await this.secureStorage.setItem(InstanceService.deviceTokenKey(instance.id), deviceToken);
    await this.activate(instance.id);
  }

  async setRefreshToken(refreshToken: string): Promise<void> {
    const active = this.instance();
    if (!active) return;
    await this.secureStorage.setItem(InstanceService.refreshKey(active.id), refreshToken);
  }

  getRefreshToken(): Promise<string | null> {
    const active = this.instance();
    return active
      ? this.secureStorage.getItem(InstanceService.refreshKey(active.id))
      : Promise.resolve(null);
  }

  /**
   * One-tap switch. The current user session leaves memory; the caller
   * re-establishes the target instance's session via its refresh token.
   */
  async activate(id: string): Promise<void> {
    if (!this._instances().some((i) => i.id === id)) return;
    this._activeId.set(id);
    await this.secureStorage.setItem(ACTIVE_KEY, id);
    this.tokenStorage.remove('forge-token');
    this.tokenStorage.remove('forge-user');
    const active = this.instance();
    this.deviceToken = active?.shared
      ? await this.secureStorage.getItem(InstanceService.deviceTokenKey(id))
      : null;
  }

  async getOrCreateDeviceUuid(): Promise<string> {
    const existing = await this.secureStorage.getItem(DEVICE_UUID_KEY);
    if (existing) return existing;
    const uuid = crypto.randomUUID();
    await this.secureStorage.setItem(DEVICE_UUID_KEY, uuid);
    return uuid;
  }

  /** Removes one instance and every credential it owned. */
  async remove(id: string): Promise<void> {
    await this.secureStorage.removeItem(InstanceService.refreshKey(id));
    await this.secureStorage.removeItem(InstanceService.deviceTokenKey(id));
    this._instances.set(this._instances().filter((i) => i.id !== id));
    await this.secureStorage.setItem(INSTANCES_KEY, JSON.stringify(this._instances()));

    if (this._activeId() === id) {
      this._activeId.set(null);
      this.deviceToken = null;
      await this.secureStorage.removeItem(ACTIVE_KEY);
      this.tokenStorage.remove('forge-token');
      this.tokenStorage.remove('forge-user');
      const next = this._instances()[0];
      if (next) await this.activate(next.id);
    }
  }

  /** Wipes the active instance — the remote-revoke / ten-strike path. */
  async wipe(): Promise<void> {
    const active = this.instance();
    if (active) await this.remove(active.id);
  }

  private async upsert(instance: MobileInstance): Promise<void> {
    const list = this._instances().filter((i) => i.id !== instance.id);
    list.push(instance);
    this._instances.set(list);
    await this.secureStorage.setItem(INSTANCES_KEY, JSON.stringify(list));
  }

  /** Pre-multi-instance builds stored one instance under flat keys. */
  private async migrateLegacy(): Promise<void> {
    const raw = await this.secureStorage.getItem(LEGACY_INSTANCE_KEY);
    if (!raw) return;
    try {
      const legacy = JSON.parse(raw) as Omit<MobileInstance, 'id'> & { id?: string };
      const instance: MobileInstance = { ...legacy, id: InstanceService.idFor(legacy.serverUrl) };
      const refresh = await this.secureStorage.getItem(LEGACY_REFRESH_KEY);
      const deviceToken = await this.secureStorage.getItem(LEGACY_DEVICE_TOKEN_KEY);
      await this.upsert(instance);
      if (refresh) await this.secureStorage.setItem(InstanceService.refreshKey(instance.id), refresh);
      if (deviceToken) await this.secureStorage.setItem(InstanceService.deviceTokenKey(instance.id), deviceToken);
      await this.secureStorage.setItem(ACTIVE_KEY, instance.id);
    } finally {
      await this.secureStorage.removeItem(LEGACY_INSTANCE_KEY);
      await this.secureStorage.removeItem(LEGACY_REFRESH_KEY);
      await this.secureStorage.removeItem(LEGACY_DEVICE_TOKEN_KEY);
    }
  }

  private static refreshKey(id: string): string {
    return `forge-mobile-refresh:${id}`;
  }

  private static deviceTokenKey(id: string): string {
    return `forge-mobile-device-token:${id}`;
  }
}
