import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminService } from './admin.service';
import { environment } from '../../../../environments/environment';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getUsers ──────────────────────────────────────────────────────────────

  describe('getUsers', () => {
    it('should GET all admin users', () => {
      const mockUsers = [
        { id: 1, firstName: 'Admin', lastName: 'User', email: 'admin@test.com', role: 'Admin' },
      ];
      let result: unknown[] = [];

      service.getUsers().subscribe((users) => { result = users; });

      const req = httpMock.expectOne(`${apiUrl}/admin/users`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);

      expect(result.length).toBe(1);
    });
  });

  // ── createUser ────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('should POST a new user and return the admin user', () => {
      const request = { firstName: 'John', lastName: 'Doe', email: 'john@test.com', role: 'Engineer' } as any;
      const mockResponse = { id: 2, firstName: 'John', lastName: 'Doe', email: 'john@test.com' };
      let result: unknown = null;

      service.createUser(request).subscribe((user) => { result = user; });

      const req = httpMock.expectOne(`${apiUrl}/admin/users`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('should PUT updated user fields', () => {
      const request = { firstName: 'Jane', role: 'Manager' } as any;
      const mockResponse = { id: 1, firstName: 'Jane', role: 'Manager' };
      let result: unknown = null;

      service.updateUser(1, request).subscribe((user) => { result = user; });

      const req = httpMock.expectOne(`${apiUrl}/admin/users/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── getReferenceData ──────────────────────────────────────────────────────

  describe('getReferenceData', () => {
    it('should GET reference data groups', () => {
      const mockGroups = [
        { groupCode: 'expense_category', entries: [{ id: 1, code: 'travel', label: 'Travel' }] },
      ];
      let result: unknown[] = [];

      service.getReferenceData().subscribe((groups) => { result = groups; });

      const req = httpMock.expectOne(`${apiUrl}/admin/reference-data`);
      expect(req.request.method).toBe('GET');
      req.flush(mockGroups);

      expect(result.length).toBe(1);
    });
  });

  // ── getTrackTypes ─────────────────────────────────────────────────────────

  describe('getTrackTypes', () => {
    it('should GET admin track types', () => {
      const mockTypes = [{ id: 1, name: 'Production', stages: [] }];
      let result: unknown[] = [];

      service.getTrackTypes().subscribe((types) => { result = types; });

      const req = httpMock.expectOne(`${apiUrl}/admin/track-types`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTypes);

      expect(result.length).toBe(1);
    });
  });

  // ── deleteTrackType ───────────────────────────────────────────────────────

  describe('deleteTrackType', () => {
    it('should DELETE the specified track type', () => {
      let completed = false;
      service.deleteTrackType(1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${apiUrl}/admin/track-types/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── deactivateUser ────────────────────────────────────────────────────────

  describe('deactivateUser', () => {
    it('should POST to deactivate the user', () => {
      let completed = false;
      service.deactivateUser(5).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${apiUrl}/admin/users/5/deactivate`);
      expect(req.request.method).toBe('POST');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── getSystemSettings ─────────────────────────────────────────────────────

  describe('getSystemSettings', () => {
    it('should GET system settings', () => {
      const mockSettings = [{ key: 'app_name', value: 'QB Engineer' }];
      let result: unknown[] = [];

      service.getSystemSettings().subscribe((s) => { result = s; });

      const req = httpMock.expectOne(`${apiUrl}/admin/system-settings`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSettings);

      expect(result.length).toBe(1);
    });
  });
});
