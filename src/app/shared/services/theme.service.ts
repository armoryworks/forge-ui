import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type ThemeMode = 'light' | 'dark';
export type FontScale = 'default' | 'comfortable' | 'large' | 'xl';

interface BrandSettings {
  primaryColor: string | null;
  accentColor: string | null;
  appName: string | null;
  hasLogo: boolean;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);
  private readonly _theme = signal<ThemeMode>('light');
  readonly theme = this._theme.asReadonly();
  private readonly _fontScale = signal<FontScale>('default');
  readonly fontScale = this._fontScale.asReadonly();
  readonly appName = signal('QB Engineer');
  readonly logoUrl = signal<string | null>(null);

  private brandColors: { primary?: string; accent?: string } = {};

  constructor() {
    const saved = localStorage.getItem('qbe-theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') {
      this._theme.set(saved);
    }
    this.applyTheme(this._theme());

    const savedScale = localStorage.getItem('qbe-font-scale') as FontScale | null;
    if (savedScale === 'comfortable' || savedScale === 'large' || savedScale === 'xl') {
      this._fontScale.set(savedScale);
    }
    this.applyFontScale(this._fontScale());

    const cachedBrand = localStorage.getItem('qbe-brand-colors');
    if (cachedBrand) {
      this.brandColors = JSON.parse(cachedBrand);
      this.applyBrandColors();
    }
  }

  toggle(): void {
    const next: ThemeMode = this._theme() === 'light' ? 'dark' : 'light';
    this._theme.set(next);
    localStorage.setItem('qbe-theme', next);
    this.applyTheme(next);
    this.applyBrandColors();
    this._broadcastThemeChange?.(next);
  }

  /** Called by BroadcastService to sync theme from another tab without re-broadcasting. */
  applyThemeFromBroadcast(theme: ThemeMode): void {
    this._theme.set(theme);
    localStorage.setItem('qbe-theme', theme);
    this.applyTheme(theme);
    this.applyBrandColors();
  }

  /** Set by BroadcastService to avoid circular dependency. */
  private _broadcastThemeChange?: (theme: ThemeMode) => void;

  /** @internal Used by BroadcastService to register the broadcast callback. */
  registerBroadcastCallback(fn: (theme: ThemeMode) => void): void {
    this._broadcastThemeChange = fn;
  }

  setBrandColors(primary?: string, accent?: string): void {
    this.brandColors = { primary, accent };
    localStorage.setItem('qbe-brand-colors', JSON.stringify(this.brandColors));
    this.applyBrandColors();
  }

  setFontScale(scale: FontScale): void {
    this._fontScale.set(scale);
    localStorage.setItem('qbe-font-scale', scale);
    this.applyFontScale(scale);
  }

  private applyTheme(theme: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private applyFontScale(scale: FontScale): void {
    if (scale === 'default') {
      document.documentElement.removeAttribute('data-font-size');
    } else {
      document.documentElement.setAttribute('data-font-size', scale);
    }
  }

  loadBrandSettings(): void {
    this.http.get<BrandSettings>(`${environment.apiUrl}/admin/brand`).subscribe({
      next: (brand) => {
        this.setBrandColors(brand.primaryColor ?? undefined, brand.accentColor ?? undefined);
        if (brand.appName) {
          this.appName.set(brand.appName);
          document.title = brand.appName;
        }
        this.logoUrl.set(brand.hasLogo ? `${environment.apiUrl}/admin/logo?t=${Date.now()}` : null);
      },
    });
  }

  private applyBrandColors(): void {
    const root = document.documentElement.style;
    if (this.brandColors.primary) {
      root.setProperty('--primary', this.brandColors.primary);
    }
    if (this.brandColors.accent) {
      root.setProperty('--accent', this.brandColors.accent);
    }
  }
}
