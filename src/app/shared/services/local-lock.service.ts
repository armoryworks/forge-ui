import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { InstanceService } from './instance.service';
import { MobileAuthService } from './mobile-auth.service';
import { PlatformService } from './platform.service';
import { SecureStorageService } from './secure-storage.service';

const SALT_KEY = 'forge-lock-salt';
const PIN_HASH_KEY = 'forge-lock-pin';
const FAILS_KEY = 'forge-lock-fails';
const BIOMETRIC_KEY = 'forge-lock-biometric';

const MAX_FAILURES = 10;
const DEFAULT_IDLE_MINUTES = 15;

/**
 * Local unlock for the native shell: 6-digit PIN (salted SHA-256 in secure
 * storage) with optional biometric, an idle timeout fetched from the
 * instance's per-role policy, and a ten-strike wipe. Locking hides the app
 * behind /app/lock — it never logs out or touches the offline queue.
 */
@Injectable({ providedIn: 'root' })
export class LocalLockService {
  private readonly secureStorage = inject(SecureStorageService);
  private readonly platform = inject(PlatformService);
  private readonly mobileAuth = inject(MobileAuthService);
  private readonly instances = inject(InstanceService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _locked = signal(false);
  readonly locked = this._locked.asReadonly();

  private readonly _pinConfigured = signal(false);
  readonly pinConfigured = this._pinConfigured.asReadonly();

  private readonly _biometricEnabled = signal(false);
  readonly biometricEnabled = this._biometricEnabled.asReadonly();

  private readonly _failures = signal(0);
  readonly failures = this._failures.asReadonly();
  readonly maxFailures = MAX_FAILURES;

  private idleTimeoutMs = DEFAULT_IDLE_MINUTES * 60_000;
  private lastActivity = Date.now();
  private returnUrl: string | null = null;
  private watching = false;

  /**
   * Starts the lock lifecycle: hydrates PIN state, locks the cold start,
   * and begins idle/background watching. Called by the shell once an
   * enrolled instance exists. No-op outside the native shell build.
   */
  async start(): Promise<void> {
    // Shared devices identify per transaction (badge + PIN); no device lock.
    if (!environment.mobileShell || this.watching || this.instances.instance()?.shared) return;
    this.watching = true;

    this._pinConfigured.set(await this.secureStorage.getItem(PIN_HASH_KEY) !== null);
    this._biometricEnabled.set(await this.secureStorage.getItem(BIOMETRIC_KEY) === 'true');
    this._failures.set(Number(await this.secureStorage.getItem(FAILS_KEY) ?? '0'));

    this.refreshPolicy();
    this.trackActivity();

    // Cold start locks without navigating — the router's initial navigation
    // hits the lock guard and lands on /app/lock itself.
    if (this._pinConfigured()) this._locked.set(true);
  }

  /** Fetches the per-role idle timeout; keeps the previous value on failure. */
  refreshPolicy(): void {
    this.http.get<{ idleTimeoutMinutes: number }>('/api/v1/devices/lock-policy').subscribe({
      next: (policy) => {
        if (policy.idleTimeoutMinutes > 0) {
          this.idleTimeoutMs = policy.idleTimeoutMinutes * 60_000;
        }
      },
      error: () => undefined,
    });
  }

  async setPin(pin: string): Promise<void> {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    await this.secureStorage.setItem(SALT_KEY, salt);
    await this.secureStorage.setItem(PIN_HASH_KEY, await LocalLockService.hash(salt, pin));
    await this.secureStorage.setItem(FAILS_KEY, '0');
    this._failures.set(0);
    this._pinConfigured.set(true);
  }

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    this._biometricEnabled.set(enabled);
    await this.secureStorage.setItem(BIOMETRIC_KEY, String(enabled));
  }

  async biometricAvailable(): Promise<boolean> {
    if (!this.platform.isNative) return false;
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      const result = await BiometricAuth.checkBiometry();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  /** True on success. Failure counts toward the ten-strike wipe. */
  async verifyPin(pin: string): Promise<boolean> {
    const salt = await this.secureStorage.getItem(SALT_KEY);
    const stored = await this.secureStorage.getItem(PIN_HASH_KEY);
    if (!salt || !stored) return false;

    if (await LocalLockService.hash(salt, pin) === stored) {
      await this.secureStorage.setItem(FAILS_KEY, '0');
      this._failures.set(0);
      this.unlock();
      return true;
    }

    const failures = this._failures() + 1;
    this._failures.set(failures);
    await this.secureStorage.setItem(FAILS_KEY, String(failures));

    if (failures >= MAX_FAILURES) {
      await this.wipe();
    }
    return false;
  }

  /** Biometric unlock; PIN pad stays as the fallback. */
  async tryBiometric(): Promise<boolean> {
    if (!this._biometricEnabled() || !this.platform.isNative) return false;
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      await BiometricAuth.authenticate();
      await this.secureStorage.setItem(FAILS_KEY, '0');
      this._failures.set(0);
      this.unlock();
      return true;
    } catch {
      return false;
    }
  }

  lock(): void {
    if (this._locked() || !this._pinConfigured()) return;
    this._locked.set(true);
    const current = this.router.url;
    this.returnUrl = current.startsWith('/app') && !current.startsWith('/app/lock')
      ? current
      : '/app/scan';
    this.router.navigate(['/app/lock']);
  }

  private unlock(): void {
    this._locked.set(false);
    this.lastActivity = Date.now();
    this.router.navigateByUrl(this.returnUrl ?? '/app/scan');
    this.returnUrl = null;
  }

  private async wipe(): Promise<void> {
    await this.secureStorage.removeItem(SALT_KEY);
    await this.secureStorage.removeItem(PIN_HASH_KEY);
    await this.secureStorage.removeItem(FAILS_KEY);
    await this.secureStorage.removeItem(BIOMETRIC_KEY);
    this._pinConfigured.set(false);
    this._locked.set(false);
    await this.mobileAuth.wipeAndRestart();
  }

  private trackActivity(): void {
    const touch = () => { this.lastActivity = Date.now(); };
    document.addEventListener('pointerdown', touch, { passive: true });
    document.addEventListener('keydown', touch, { passive: true });

    setInterval(() => {
      if (!this._locked() && this._pinConfigured() &&
          Date.now() - this.lastActivity > this.idleTimeoutMs) {
        this.lock();
      }
    }, 30_000);

    if (this.platform.isNative) {
      void this.watchAppState();
    }
  }

  private async watchAppState(): Promise<void> {
    const { App } = await import('@capacitor/app');
    let backgroundedAt: number | null = null;
    await App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt = Date.now();
        return;
      }
      if (backgroundedAt !== null &&
          Date.now() - backgroundedAt > this.idleTimeoutMs &&
          this._pinConfigured()) {
        this.lock();
      }
      backgroundedAt = null;
      this.refreshPolicy();
    });
  }

  private static async hash(salt: string, pin: string): Promise<string> {
    const data = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
