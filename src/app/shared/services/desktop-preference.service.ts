import { inject, Injectable } from '@angular/core';

import { AuthService } from './auth.service';

const KEY_PREFIX = 'forge-prefer-desktop:';

@Injectable({ providedIn: 'root' })
export class DesktopPreferenceService {
  private readonly auth = inject(AuthService);

  isPreferred(): boolean {
    const key = this.key();
    if (!key) return false;
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  prefer(): boolean {
    const key = this.key();
    return !!key && this.tryStorage(() => localStorage.setItem(key, 'true'));
  }

  clear(): void {
    const key = this.key();
    if (key) this.tryStorage(() => localStorage.removeItem(key));
  }

  private key(): string | null {
    const id = this.auth.user()?.id;
    return id ? `${KEY_PREFIX}${id}` : null;
  }

  private tryStorage(write: () => void): boolean {
    try {
      write();
      return true;
    } catch {
      return false;
    }
  }
}
