import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UserPreferencesService } from './user-preferences.service';
import { environment } from '../../../environments/environment';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/user-preferences`;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(UserPreferencesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should return null for unknown keys', () => {
      expect(service.get('nonexistent')).toBeNull();
    });

    it('should return empty object from getAll when no prefs set', () => {
      expect(service.getAll()).toEqual({});
    });
  });

  describe('get and set', () => {
    it('should store and retrieve a preference', () => {
      service.set('theme:mode', 'dark');

      expect(service.get('theme:mode')).toBe('dark');
    });

    it('should store complex objects', () => {
      const tablePrefs = { columns: ['a', 'b'], sortBy: 'name' };
      service.set('table:parts', tablePrefs);

      expect(service.get('table:parts')).toEqual(tablePrefs);
    });

    it('should persist to localStorage', () => {
      service.set('sidebar:collapsed', true);

      const stored = localStorage.getItem('qb-eng:pref:sidebar:collapsed');
      expect(stored).toBe('true');
    });

    it('should overwrite existing value', () => {
      service.set('theme:mode', 'light');
      service.set('theme:mode', 'dark');

      expect(service.get('theme:mode')).toBe('dark');
    });
  });

  describe('load', () => {
    it('should fetch preferences from API', () => {
      service.load();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush([
        { key: 'theme:mode', valueJson: '"dark"' },
        { key: 'sidebar:collapsed', valueJson: 'true' },
      ]);

      expect(service.get('theme:mode')).toBe('dark');
      expect(service.get('sidebar:collapsed')).toBe(true);
    });

    it('should handle API errors gracefully', () => {
      service.load();

      const req = httpMock.expectOne(baseUrl);
      req.error(new ProgressEvent('error'));

      // Should not throw — keeps localStorage cache
      expect(service.get('theme:mode')).toBeNull();
    });

    it('should skip malformed JSON entries', () => {
      service.load();

      const req = httpMock.expectOne(baseUrl);
      req.flush([
        { key: 'good', valueJson: '"value"' },
        { key: 'bad', valueJson: '{invalid json' },
      ]);

      expect(service.get('good')).toBe('value');
      expect(service.get('bad')).toBeNull();
    });
  });

  describe('reset', () => {
    it('should remove preference from cache and localStorage', () => {
      service.set('theme:mode', 'dark');
      service.reset('theme:mode');

      expect(service.get('theme:mode')).toBeNull();
      expect(localStorage.getItem('qb-eng:pref:theme:mode')).toBeNull();

      // Should issue DELETE to API
      const req = httpMock.expectOne(`${baseUrl}/${encodeURIComponent('theme:mode')}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('remove', () => {
    it('should delegate to reset', () => {
      service.set('key', 'val');
      service.remove('key');

      expect(service.get('key')).toBeNull();

      // Consume the DELETE request
      httpMock.expectOne(`${baseUrl}/key`).flush(null);
    });
  });

  describe('getAll', () => {
    it('should return all cached preferences as a record', () => {
      service.set('a', 1);
      service.set('b', 'two');

      const all = service.getAll();
      expect(all).toEqual({ a: 1, b: 'two' });
    });
  });

  describe('localStorage restore', () => {
    it('should restore preferences from localStorage on construction', () => {
      localStorage.setItem('qb-eng:pref:cached:key', '"restored"');

      // Create a new service instance by resetting the TestBed
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      });

      const freshService = TestBed.inject(UserPreferencesService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      expect(freshService.get('cached:key')).toBe('restored');

      freshHttpMock.verify();
    });
  });
});
