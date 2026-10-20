import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { ThemeService } from './theme.service';

/**
 * Sets the browser tab title from the deepest route that declares
 * `data.titleKey`, translated, followed by the install's app name. Routes with
 * `data.titleTabPrefix` translate their `:tab` param under that prefix and
 * fall back to `titleKey` when no such label exists. Customer portal routes end
 * with the supplier's portal name instead of the app name. The title is
 * re-applied when the language, the catalog or the brand settings change.
 */
@Injectable({ providedIn: 'root' })
export class ForgeTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private readonly theme = inject(ThemeService);
  private lastSnapshot: RouterStateSnapshot | null = null;

  constructor() {
    super();
    merge(this.translate.onLangChange, this.translate.onTranslationChange).subscribe(() => this.reapply());
    effect(() => {
      this.theme.appName();
      this.theme.companyName();
      this.reapply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.lastSnapshot = snapshot;
    this.title.setTitle(this.compose(snapshot));
  }

  /** Builds the tab title for a router state without applying it. */
  compose(snapshot: RouterStateSnapshot): string {
    const page = this.pageTitle(snapshot.root);
    const suffix = this.isPortal(snapshot.url) ? this.portalSuffix() : this.theme.appName();
    return page ? `${page} - ${suffix}` : suffix;
  }

  private reapply(): void {
    if (this.lastSnapshot) this.title.setTitle(this.compose(this.lastSnapshot));
  }

  private pageTitle(root: ActivatedRouteSnapshot): string | null {
    let found: string | null = null;
    for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
      const data = route.routeConfig?.data;
      const key = data?.['titleKey'] as string | undefined;
      if (key) found = this.label(key);
      const prefix = data?.['titleTabPrefix'] as string | undefined;
      const tab = route.paramMap.get('tab');
      if (prefix && tab) found = this.tabLabel(prefix, tab) ?? found;
    }
    return found;
  }

  private tabLabel(prefix: string, tab: string): string | null {
    return this.label(prefix + tab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()));
  }

  private label(key: string): string | null {
    const label = this.translate.instant(key);
    return typeof label === 'string' && label !== key ? label : null;
  }

  private isPortal(url: string): boolean {
    return url === '/portal' || url.startsWith('/portal/') || url.startsWith('/portal?');
  }

  private portalSuffix(): string {
    const company = this.theme.companyName() || this.theme.appName();
    return this.translate.instant('portal.companyPortal', { company }) as string;
  }
}
