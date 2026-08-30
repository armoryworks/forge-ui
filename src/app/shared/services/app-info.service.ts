import { Injectable, inject, signal } from '@angular/core';

import { PlatformService } from './platform.service';

/** App build identity for the About block and crash/problem reports. */
@Injectable({ providedIn: 'root' })
export class AppInfoService {
  private readonly platform = inject(PlatformService);

  readonly version = signal<string>('web');
  readonly build = signal<string | null>(null);

  async load(): Promise<void> {
    if (!this.platform.isNative) return;
    try {
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      this.version.set(info.version);
      this.build.set(info.build);
    } catch {
      this.version.set('unknown');
    }
  }
}
