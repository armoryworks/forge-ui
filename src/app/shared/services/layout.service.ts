import { Injectable, signal, computed, NgZone, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

const MOBILE_BREAKPOINT = 768;

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  private readonly _sidebarCollapsed = signal(this.loadCollapsedState());
  private readonly _mobileMenuOpen = signal(false);
  private readonly _isMobile = signal(window.innerWidth < MOBILE_BREAKPOINT);

  /**
   * True when running on a phone-like device (touch + narrow viewport).
   * Used for auto-redirect to `/m/` after login — NOT the same as `isMobile`,
   * which toggles sidebar behavior at the breakpoint.
   * Re-evaluated on every access via computed to avoid stale one-shot detection.
   */
  readonly isMobileDevice = computed(() => {
    // Subscribe to _isMobile so this recomputes on resize
    this._isMobile();
    return this.detectMobileDevice();
  });
  private readonly _isDisplayRoute = signal(this.checkDisplayRoute(window.location.pathname));
  private readonly _isAccountRoute = signal(this.checkAccountRoute(window.location.pathname));
  private readonly _isAuthRoute = signal(this.checkAuthRoute(window.location.pathname));
  private readonly _isOnboardingRoute = signal(this.checkOnboardingRoute(window.location.pathname));
  private readonly _breadcrumbLabel = signal(this.routeToLabel(window.location.pathname));
  private readonly _breadcrumbRoute = signal(this.routeToPath(window.location.pathname));

  readonly sidebarCollapsed = this._sidebarCollapsed.asReadonly();
  readonly mobileMenuOpen = this._mobileMenuOpen.asReadonly();
  readonly isMobile = this._isMobile.asReadonly();
  readonly isDisplayRoute = this._isDisplayRoute.asReadonly();
  readonly isAccountRoute = this._isAccountRoute.asReadonly();
  readonly isAuthRoute = this._isAuthRoute.asReadonly();
  readonly isOnboardingRoute = this._isOnboardingRoute.asReadonly();
  readonly breadcrumbLabel = this._breadcrumbLabel.asReadonly();
  readonly breadcrumbRoute = this._breadcrumbRoute.asReadonly();

  readonly sidebarVisible = computed(() => {
    if (this._isDisplayRoute()) return false;
    if (this._isAccountRoute()) return false;
    if (this._isOnboardingRoute()) return false;
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
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(e => {
      this._isDisplayRoute.set(this.checkDisplayRoute(e.urlAfterRedirects));
      this._isAccountRoute.set(this.checkAccountRoute(e.urlAfterRedirects));
      this._isAuthRoute.set(this.checkAuthRoute(e.urlAfterRedirects));
      this._isOnboardingRoute.set(this.checkOnboardingRoute(e.urlAfterRedirects));
      this._breadcrumbLabel.set(this.routeToLabel(e.urlAfterRedirects));
      this._breadcrumbRoute.set(this.routeToPath(e.urlAfterRedirects));
    });

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

  private checkDisplayRoute(url: string): boolean {
    return url.startsWith('/display/') || url.startsWith('/__render-form') || url.startsWith('/m/') || url === '/m' || url.startsWith('/chat/popout');
  }

  private checkAccountRoute(url: string): boolean {
    return url.startsWith('/account');
  }

  private checkAuthRoute(url: string): boolean {
    return url.startsWith('/login') || url.startsWith('/setup') || url.startsWith('/sso/callback');
  }

  private checkOnboardingRoute(url: string): boolean {
    return url.startsWith('/onboarding');
  }

  private routeToPath(url: string): string {
    const pathname = url.split('?')[0];
    const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
    return `/${segment}`;
  }

  private routeToLabel(url: string): string {
    const labels: Record<string, string> = {
      dashboard: 'Dashboard',
      kanban: 'Kanban Board',
      backlog: 'Backlog',
      planning: 'Planning',
      calendar: 'Calendar',
      parts: 'Parts Catalog',
      inventory: 'Inventory',
      customers: 'Customers',
      vendors: 'Vendors',
      quotes: 'Quotes',
      'sales-orders': 'Sales Orders',
      'purchase-orders': 'Purchase Orders',
      shipments: 'Shipments',
      invoices: 'Invoices',
      payments: 'Payments',
      leads: 'Leads',
      expenses: 'Expenses',
      assets: 'Assets',
      'time-tracking': 'Time Tracking',
      quality: 'Quality',
      reports: 'Reports',
      admin: 'Admin',
      account: 'Account',
      ai: 'AI Assistants',
      chat: 'Chat',
      notifications: 'Notifications',
    };
    // Strip query params, then extract first path segment: "/parts/42?detail=part:1" → "parts"
    const pathname = url.split('?')[0];
    const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
    return labels[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Returns the default post-login route: `/m` for mobile devices, `/dashboard` for desktop.
   * Use this everywhere a login flow redirects the user.
   */
  getDefaultRoute(): string {
    return this.isMobileDevice() ? '/m' : '/dashboard';
  }

  private detectMobileDevice(): boolean {
    const hasTouch = navigator.maxTouchPoints > 0;
    // Check both dimensions — landscape phones have innerWidth > breakpoint
    // but the shorter dimension (height in landscape, width in portrait) reveals the phone form factor
    const narrowDimension = Math.min(window.innerWidth, window.innerHeight);
    const isPhoneSize = narrowDimension < MOBILE_BREAKPOINT;
    // User-agent fallback for edge cases (e.g., desktop touchscreen monitors)
    const mobileUA = /Android|iPhone|iPod|webOS|BlackBerry|Opera Mini/i.test(navigator.userAgent);
    // Standalone PWA or Capacitor native always counts as mobile device
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const result = (hasTouch && isPhoneSize) || (hasTouch && mobileUA) || isStandalone;
    return result;
  }
}
