import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { PlatformService } from './platform.service';
import { SecureStorageService } from './secure-storage.service';

/**
 * Synchronous facade over auth-credential storage. Web: localStorage,
 * exactly as before. Native shell: an in-memory map hydrated from
 * Keychain/Keystore before the router starts (see the app initializer),
 * with writes mirrored back fire-and-forget — tokens never touch the
 * WebView's localStorage on a device.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly platform = inject(PlatformService);
  private readonly secureStorage = inject(SecureStorageService);

  private static readonly KEYS = ['forge-token', 'forge-user', 'forge-trusted-device'];

  private readonly memory = new Map<string, string>();

  private get useSecure(): boolean {
    return environment.mobileShell && this.platform.isNative;
  }

  /** Loads credentials into memory on the native shell. No-op on web. */
  async hydrate(): Promise<void> {
    if (!this.useSecure) return;
    for (const key of TokenStorageService.KEYS) {
      const value = await this.secureStorage.getItem(key);
      if (value !== null) this.memory.set(key, value);
    }
  }

  get(key: string): string | null {
    if (this.useSecure) return this.memory.get(key) ?? null;
    return localStorage.getItem(key);
  }

  set(key: string, value: string): void {
    if (this.useSecure) {
      this.memory.set(key, value);
      void this.secureStorage.setItem(key, value);
      return;
    }
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    if (this.useSecure) {
      this.memory.delete(key);
      void this.secureStorage.removeItem(key);
      return;
    }
    localStorage.removeItem(key);
  }
}
