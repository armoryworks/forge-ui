import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ThemeService } from './theme.service';

export type LockupKind = 'wordmark' | 'marquee' | 'favicon';

/**
 * Resolves branding-lockup URLs for the auth screens (marquee), the app
 * chrome (wordmark), and the browser tab (favicon). The endpoint returns the
 * admin-uploaded image if one exists, else falls back to the bundled Forge
 * default SVG.
 *
 * URLs are computed signals that re-resolve when the theme flips, so the
 * default-fallback variant (dark/light) tracks the active theme automatically.
 * Admin uploads ignore the theme query — they're served as-is.
 *
 * After an admin uploads or resets a lockup, call refresh() — it bumps a
 * cache-bust token so every consumer re-fetches without a full page reload.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly theme = inject(ThemeService);
  private readonly cacheBust = signal(0);

  readonly wordmarkUrl = computed(() => this.urlFor('wordmark'));
  readonly marqueeUrl = computed(() => this.urlFor('marquee'));
  readonly faviconUrl = computed(() => this.urlFor('favicon'));

  /** Bump the cache-bust token so consumers re-fetch the lockup images. */
  refresh(): void {
    this.cacheBust.set(Date.now());
  }

  private urlFor(kind: LockupKind): string {
    const bust = this.cacheBust();
    const bustParam = bust ? `&t=${bust}` : '';
    return `${environment.apiUrl}/admin/branding/${kind}?theme=${this.theme.theme()}${bustParam}`;
  }
}
