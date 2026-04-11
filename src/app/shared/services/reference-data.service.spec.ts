import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ReferenceDataService, ReferenceDataItem } from './reference-data.service';
import { environment } from '../../../environments/environment';

describe('ReferenceDataService', () => {
  let service: ReferenceDataService;
  let httpMock: HttpTestingController;

  const mockItems: ReferenceDataItem[] = [
    { id: 1, groupCode: 'expense_category', code: 'travel', label: 'Travel', sortOrder: 1, isActive: true },
    { id: 2, groupCode: 'expense_category', code: 'supplies', label: 'Supplies', sortOrder: 2, isActive: true },
    { id: 3, groupCode: 'expense_category', code: 'archived', label: 'Archived', sortOrder: 3, isActive: false },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReferenceDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ReferenceDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getByGroup ──

  it('getByGroup should fetch and cache reference data', () => {
    service.getByGroup('expense_category').subscribe((items) => {
      expect(items.length).toBe(3);
      expect(items[0].code).toBe('travel');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`);
    expect(req.request.method).toBe('GET');
    req.flush(mockItems);
  });

  it('getByGroup should return cached data on second call', () => {
    // First call — hits API
    service.getByGroup('expense_category').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`);
    req.flush(mockItems);

    // Second call — cached, no HTTP
    service.getByGroup('expense_category').subscribe((items) => {
      expect(items.length).toBe(3);
    });

    httpMock.expectNone(`${environment.apiUrl}/reference-data/expense_category`);
  });

  // ── getAsOptions ──

  it('getAsOptions should convert to SelectOption array', () => {
    service.getAsOptions('expense_category').subscribe((options) => {
      // Inactive items filtered out
      expect(options.length).toBe(2);
      expect(options[0]).toEqual({ value: 'travel', label: 'Travel' });
      expect(options[1]).toEqual({ value: 'supplies', label: 'Supplies' });
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`);
    req.flush(mockItems);
  });

  it('getAsOptions should prepend allLabel when provided', () => {
    service.getAsOptions('expense_category', { allLabel: '-- All --' }).subscribe((options) => {
      expect(options.length).toBe(3);
      expect(options[0]).toEqual({ value: null, label: '-- All --' });
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`);
    req.flush(mockItems);
  });

  it('getAsOptions should use label field when valueField is label', () => {
    service.getAsOptions('expense_category', { valueField: 'label' }).subscribe((options) => {
      expect(options[0].value).toBe('Travel');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`);
    req.flush(mockItems);
  });

  // ── getRoles ──

  it('getRoles should fetch from /api/v1/admin/roles endpoint', () => {
    const mockRoles = [{ name: 'Admin' }, { name: 'Engineer' }];

    service.getRoles().subscribe((roles) => {
      expect(roles.length).toBe(2);
      expect(roles[0].name).toBe('Admin');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/roles`);
    expect(req.request.method).toBe('GET');
    req.flush(mockRoles);
  });

  it('getRoles should cache results', () => {
    const mockRoles = [{ name: 'Admin' }];

    service.getRoles().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/admin/roles`).flush(mockRoles);

    service.getRoles().subscribe((roles) => {
      expect(roles.length).toBe(1);
    });
    httpMock.expectNone(`${environment.apiUrl}/admin/roles`);
  });

  // ── clearCache ──

  it('clearCache should clear all cached data', () => {
    // Populate cache
    service.getByGroup('expense_category').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`).flush(mockItems);

    service.getRoles().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/admin/roles`).flush([{ name: 'Admin' }]);

    // Clear cache
    service.clearCache();

    // Should re-fetch from API
    service.getByGroup('expense_category').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`).flush(mockItems);

    service.getRoles().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/admin/roles`).flush([{ name: 'Admin' }]);
  });

  // ── clearGroupCache ──

  it('clearGroupCache should clear specific group cache', () => {
    // Populate two groups
    service.getByGroup('expense_category').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`).flush(mockItems);

    service.getByGroup('lead_source').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/reference-data/lead_source`).flush([]);

    // Clear only expense_category
    service.clearGroupCache('expense_category');

    // expense_category should re-fetch
    service.getByGroup('expense_category').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/reference-data/expense_category`).flush(mockItems);

    // lead_source should still be cached
    service.getByGroup('lead_source').subscribe();
    httpMock.expectNone(`${environment.apiUrl}/reference-data/lead_source`);
  });
});
