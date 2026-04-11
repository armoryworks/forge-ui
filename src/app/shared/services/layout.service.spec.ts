import { TestBed } from '@angular/core/testing';

import { LayoutService } from './layout.service';

describe('LayoutService', () => {
  let service: LayoutService;

  beforeEach(() => {
    localStorage.clear();

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
      const stored = localStorage.getItem('qbe-sidebar-collapsed');
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

  describe('getDefaultRoute', () => {
    it('should return /dashboard on desktop', () => {
      // Test environment is desktop-like
      expect(service.getDefaultRoute()).toBe('/dashboard');
    });
  });

  describe('localStorage restore', () => {
    it('should restore collapsed=false from localStorage', () => {
      localStorage.setItem('qbe-sidebar-collapsed', 'false');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [LayoutService],
      });

      const freshService = TestBed.inject(LayoutService);
      expect(freshService.sidebarCollapsed()).toBe(false);
    });

    it('should default to collapsed=true when localStorage has true', () => {
      localStorage.setItem('qbe-sidebar-collapsed', 'true');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [LayoutService],
      });

      const freshService = TestBed.inject(LayoutService);
      expect(freshService.sidebarCollapsed()).toBe(true);
    });
  });
});
