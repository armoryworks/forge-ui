import { Injectable, computed, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ThemeService } from './theme.service';

export type LockupKind = 'wordmark' | 'marquee';

/**
 * Resolves branding-lockup URLs for the auth screens (marquee) and the app
 * chrome (wordmark). The endpoint returns the admin-uploaded image if one
 * exists, else falls back to the bundled Forge default SVG.
 *
 * URLs are computed signals that re-resolve when the theme flips, so the
 * default-fallback variant (dark/light) tracks the active theme automatically.
 * Admin uploads ignore the theme query — they're served as-is.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly theme = inject(ThemeService);

  readonly wordmarkUrl = computed(() => this.urlFor('wordmark'));
  readonly marqueeUrl = computed(() => this.urlFor('marquee'));

  private urlFor(kind: LockupKind): string {
    return `${environment.apiUrl}/admin/branding/${kind}?theme=${this.theme.theme()}`;
  }
}
