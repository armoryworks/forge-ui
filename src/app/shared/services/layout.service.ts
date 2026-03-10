import { Injectable, signal, computed, NgZone, inject, DestroyRef } from '@angular/core';

const MOBILE_BREAKPOINT = 768;

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _sidebarCollapsed = signal(this.loadCollapsedState());
  private readonly _mobileMenuOpen = signal(false);
  private readonly _isMobile = signal(window.innerWidth < MOBILE_BREAKPOINT);

  readonly sidebarCollapsed = this._sidebarCollapsed.asReadonly();
  readonly mobileMenuOpen = this._mobileMenuOpen.asReadonly();
  readonly isMobile = this._isMobile.asReadonly();

  readonly sidebarVisible = computed(() => {
    if (this._isMobile()) {
      return this._mobileMenuOpen();
    }
    return true;
  });

  readonly sidebarExpanded = computed(() => {
    if (this._isMobile()) {
      return true; // always expanded when shown on mobile
    }
    return !this._sidebarCollapsed();
  });

  constructor() {
    this.ngZone.runOutsideAngular(() => {
      const onResize = () => {
        const wasMobile = this._isMobile();
        const nowMobile = window.innerWidth < MOBILE_BREAKPOINT;
        if (wasMobile !== nowMobile) {
          this.ngZone.run(() => {
            this._isMobile.set(nowMobile);
            if (!nowMobile) {
              this._mobileMenuOpen.set(false);
            }
          });
        }
      };
      window.addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    });
  }

  toggleSidebar(): void {
    if (this._isMobile()) {
      this._mobileMenuOpen.update(v => !v);
    } else {
      const next = !this._sidebarCollapsed();
      this._sidebarCollapsed.set(next);
      localStorage.setItem('qbe-sidebar-collapsed', String(next));
    }
  }

  closeMobileMenu(): void {
    this._mobileMenuOpen.set(false);
  }

  private loadCollapsedState(): boolean {
    return localStorage.getItem('qbe-sidebar-collapsed') !== 'false';
  }
}
