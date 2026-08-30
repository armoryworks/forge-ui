import { Injectable } from '@angular/core';

import { Capacitor } from '@capacitor/core';

import { environment } from '../../../environments/environment';

import { PlatformName } from '../models/platform-name.model';

/**
 * Single seam for web-vs-native differences. Feature code never imports
 * Capacitor directly — it asks this service. The web PWA and the native
 * shell share every component; only implementations behind this service
 * may differ per platform.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  /** True in the Capacitor build; services branch on this, not on the environment module, so tests can stub it. */
  readonly mobileShell: boolean = environment.mobileShell;
  readonly isNative: boolean = Capacitor.isNativePlatform();
  readonly name: PlatformName = Capacitor.getPlatform() as PlatformName;
  readonly isIos: boolean = this.name === 'ios';
  readonly isAndroid: boolean = this.name === 'android';
}
