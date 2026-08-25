import { Injectable, inject } from '@angular/core';

import { PlatformService } from './platform.service';

/**
 * Key-value storage for secrets (tokens, PIN hashes, pinned certificates).
 * Native shell: Keychain (iOS) / Keystore-backed EncryptedSharedPreferences
 * (Android) via @aparajita/capacitor-secure-storage, loaded on demand so the
 * plugin stays out of the web bundle. Web: localStorage, matching the
 * existing PWA behavior — never store anything here on web that today's app
 * would not already put in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private readonly platform = inject(PlatformService);

  private nativeStore?: Promise<typeof import('@aparajita/capacitor-secure-storage')>;

  async setItem(key: string, value: string): Promise<void> {
    if (this.platform.isNative) {
      const { SecureStorage } = await this.loadNative();
      await SecureStorage.set(key, value);
      return;
    }
    localStorage.setItem(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    if (this.platform.isNative) {
      const { SecureStorage } = await this.loadNative();
      const value = await SecureStorage.get(key);
      return typeof value === 'string' ? value : null;
    }
    return localStorage.getItem(key);
  }

  async removeItem(key: string): Promise<void> {
    if (this.platform.isNative) {
      const { SecureStorage } = await this.loadNative();
      await SecureStorage.remove(key);
      return;
    }
    localStorage.removeItem(key);
  }

  private loadNative(): Promise<typeof import('@aparajita/capacitor-secure-storage')> {
    this.nativeStore ??= import('@aparajita/capacitor-secure-storage');
    return this.nativeStore;
  }
}
