import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ThemeService } from './theme.service';
import { environment } from '../../../environments/environment';

describe('ThemeService', () => {
  let service: ThemeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--accent');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ThemeService,
      ],
    });

    // Create a fresh instance each time (not the root singleton)
    service = TestBed.inject(ThemeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should default to light theme', () => {
      expect(service.theme()).toBe('light');
    });

    it('should apply data-theme attribute to document element', () => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should default appName to QB Engineer', () => {
      expect(service.appName()).toBe('QB Engineer');
    });

    it('should default logoUrl to null', () => {
      expect(service.logoUrl()).toBeNull();
    });
  });

  describe('toggle', () => {
    it('should switch from light to dark', () => {
      service.toggle();

      expect(service.theme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('qbe-theme')).toBe('dark');
    });

    it('should switch from dark back to light', () => {
      service.toggle(); // light → dark
      service.toggle(); // dark → light

      expect(service.theme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('qbe-theme')).toBe('light');
    });
  });

  describe('setBrandColors', () => {
    it('should apply primary color to CSS custom property', () => {
      service.setBrandColors('#ff0000');

      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#ff0000');
    });

    it('should apply accent color to CSS custom property', () => {
      service.setBrandColors(undefined, '#00ff00');

      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#00ff00');
    });

    it('should persist brand colors to localStorage', () => {
      service.setBrandColors('#ff0000', '#00ff00');

      const stored = JSON.parse(localStorage.getItem('qbe-brand-colors')!);
      expect(stored.primary).toBe('#ff0000');
      expect(stored.accent).toBe('#00ff00');
    });
  });

  describe('loadBrandSettings', () => {
    it('should fetch brand settings from API and apply them', () => {
      service.loadBrandSettings();

      const req = httpMock.expectOne(`${environment.apiUrl}/admin/brand`);
      expect(req.request.method).toBe('GET');

      req.flush({
        primaryColor: '#123456',
        accentColor: '#654321',
        appName: 'My Shop',
        hasLogo: false,
      });

      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#123456');
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#654321');
      expect(service.appName()).toBe('My Shop');
      expect(service.logoUrl()).toBeNull();
    });

    it('should set logoUrl when hasLogo is true', () => {
      service.loadBrandSettings();

      const req = httpMock.expectOne(`${environment.apiUrl}/admin/brand`);
      req.flush({
        primaryColor: null,
        accentColor: null,
        appName: null,
        hasLogo: true,
      });

      expect(service.logoUrl()).toContain(`${environment.apiUrl}/admin/logo`);
    });

    it('should keep default appName when API returns null', () => {
      service.loadBrandSettings();

      const req = httpMock.expectOne(`${environment.apiUrl}/admin/brand`);
      req.flush({
        primaryColor: null,
        accentColor: null,
        appName: null,
        hasLogo: false,
      });

      expect(service.appName()).toBe('QB Engineer');
    });
  });
});
