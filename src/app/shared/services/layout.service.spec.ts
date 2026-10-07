import { TestBed } from '@angular/core/testing';

import { DesktopPreferenceService } from './desktop-preference.service';
import { LayoutService } from './layout.service';

describe('LayoutService', () => {
  let service: LayoutService;

  beforeEach(() => {
    localStorage.clear();

    // jsdom does not implement window.matchMedia — stub it so detectMobileDevice doesn't throw
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    TestBed.configureTestingModule({
      providers: [LayoutService],
    });

    service = TestBed.inject(LayoutService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should have sidebar collapsed by default when no localStorage value', () => {
      // Default: localStorage returns null, which !== 'false', so collapsed = true
      expect(service.sidebarCollapsed()).toBe(true);
    });

    it('should have mobile menu closed initially', () => {
      expect(service.mobileMenuOpen()).toBe(false);
    });

    it('should detect desktop by default in test environment', () => {
      // jsdom default innerWidth is typically >= 768
      // The exact value depends on the test environment
      expect(typeof service.isMobile()).toBe('boolean');
    });
  });

  describe('toggleSidebar (desktop)', () => {
    it('should toggle sidebar collapsed state', () => {
      const initial = service.sidebarCollapsed();
      service.toggleSidebar();
      expect(service.sidebarCollapsed()).toBe(!initial);
    });

    it('should persist collapsed state to localStorage', () => {
      service.toggleSidebar();
      const stored = localStorage.getItem('forge-sidebar-collapsed');
      expect(stored).toBeTruthy();
    });

    it('should toggle back and forth', () => {
      const initial = service.sidebarCollapsed();
      service.toggleSidebar();
      service.toggleSidebar();
      expect(service.sidebarCollapsed()).toBe(initial);
    });
  });

  describe('closeMobileMenu', () => {
    it('should close the mobile menu', () => {
      service.closeMobileMenu();
      expect(service.mobileMenuOpen()).toBe(false);
    });
  });

  describe('sidebarVisible (desktop)', () => {
    it('should always be visible on desktop', () => {
      if (!service.isMobile()) {
        expect(service.sidebarVisible()).toBe(true);
      }
    });
  });

  describe('sidebarExpanded (desktop)', () => {
    it('should reflect the inverse of sidebarCollapsed on desktop', () => {
      if (!service.isMobile()) {
        expect(service.sidebarExpanded()).toBe(!service.sidebarCollapsed());
      }
    });
  });

  describe('isMobileDevice', () => {
    it('should return a boolean', () => {
      expect(typeof service.isMobileDevice()).toBe('boolean');
    });

    it('should return false in test environment (no touch, wide viewport)', () => {
      // jsdom has maxTouchPoints=0 and default wide viewport
      expect(service.isMobileDevice()).toBe(false);
    });
  });

  describe('mobile device detection', () => {
    const overridden: [object, string, PropertyDescriptor | undefined][] = [];
    const override = (target: object, key: string, value: unknown): void => {
      overridden.push([target, key, Object.getOwnPropertyDescriptor(target, key)]);
      Object.defineProperty(target, key, { configurable: true, get: () => value });
    };

    const detect = (opts: { ua: string; touch: number; width: number; height: number; standalone?: boolean }): boolean => {
      override(navigator, 'userAgent', opts.ua);
      override(navigator, 'maxTouchPoints', opts.touch);
      override(window, 'innerWidth', opts.width);
      override(window, 'innerHeight', opts.height);
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: !!opts.standalone } as MediaQueryList);
      return (service as unknown as { detectMobileDevice(): boolean }).detectMobileDevice();
    };

    const androidPhone = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
    const androidTablet = 'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
    const iPhone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

    afterEach(() => {
      vi.restoreAllMocks();
      for (const [target, key, original] of overridden.splice(0).reverse()) {
        if (original) {
          Object.defineProperty(target, key, original);
        } else {
          delete (target as Record<string, unknown>)[key];
        }
      }
    });

    it('treats an Android tablet as desktop', () => {
      expect(detect({ ua: androidTablet, touch: 10, width: 1280, height: 800 })).toBe(false);
    });

    it('treats an Android phone as mobile even in a wide landscape viewport', () => {
      expect(detect({ ua: androidPhone, touch: 5, width: 915, height: 800 })).toBe(true);
    });

    it('treats an iPhone as mobile', () => {
      expect(detect({ ua: iPhone, touch: 5, width: 1024, height: 900 })).toBe(true);
    });

    it('treats any narrow touch device as mobile', () => {
      expect(detect({ ua: androidTablet, touch: 10, width: 600, height: 900 })).toBe(true);
    });

    it('treats an installed app on a large screen as desktop', () => {
      expect(detect({ ua: 'Mozilla/5.0 (X11; Linux x86_64)', touch: 0, width: 1920, height: 1080, standalone: true })).toBe(false);
    });

    it('treats an installed app on a phone-size screen as mobile', () => {
      expect(detect({ ua: 'Mozilla/5.0 (X11; Linux x86_64)', touch: 0, width: 400, height: 800, standalone: true })).toBe(true);
    });
  });

  describe('getDefaultRoute', () => {
    it('should return /dashboard on desktop', () => {
      // Test environment is desktop-like
      expect(service.getDefaultRoute()).toBe('/dashboard');
    });

    it('sends a phone to /m', () => {
      vi.spyOn(service, 'isMobileDevice').mockReturnValue(true);
      expect(service.getDefaultRoute()).toBe('/m');
    });

    it('keeps a phone on the desktop site once the user chose it', () => {
      vi.spyOn(service, 'isMobileDevice').mockReturnValue(true);
      vi.spyOn(TestBed.inject(DesktopPreferenceService), 'isPreferred').mockReturnValue(true);
      expect(service.getDefaultRoute()).toBe('/dashboard');
    });
  });

  describe('localStorage restore', () => {
    it('should restore collapsed=false from localStorage', () => {
      localStorage.setItem('forge-sidebar-collapsed', 'false');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [LayoutService],
      });

      const freshService = TestBed.inject(LayoutService);
      expect(freshService.sidebarCollapsed()).toBe(false);
    });

    it('should default to collapsed=true when localStorage has true', () => {
      localStorage.setItem('forge-sidebar-collapsed', 'true');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [LayoutService],
      });

      const freshService = TestBed.inject(LayoutService);
      expect(freshService.sidebarCollapsed()).toBe(true);
    });
  });
});
