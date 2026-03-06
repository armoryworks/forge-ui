import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<ThemeMode>('light');
  readonly theme = this._theme.asReadonly();

  constructor() {
    const saved = localStorage.getItem('qbe-theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') {
      this._theme.set(saved);
    }
    this.applyTheme(this._theme());
  }

  toggle(): void {
    const next: ThemeMode = this._theme() === 'light' ? 'dark' : 'light';
    this._theme.set(next);
    localStorage.setItem('qbe-theme', next);
    this.applyTheme(next);
  }

  private applyTheme(theme: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
