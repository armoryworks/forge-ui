import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UserIntegrationService } from './user-integration.service';

describe('UserIntegrationService', () => {
  let service: UserIntegrationService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/v1/user-integrations';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserIntegrationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('loadIntegrations', () => {
    it('should GET integrations and update signal', () => {
      const mockData = [{ id: 1, category: 'accounting', providerId: 'qbo' }];
      service.loadIntegrations();
      expect(service.loading()).toBe(true);

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockData);

      expect(service.integrations()).toEqual(mockData as any);
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false on error', () => {
      service.loadIntegrations();
      const req = httpMock.expectOne(baseUrl);
      req.flush('error', { status: 500, statusText: 'Server Error' });
      expect(service.loading()).toBe(false);
    });
  });

  describe('loadProviders', () => {
    it('should GET providers and update signal', () => {
      const mockProviders = [{ providerId: 'qbo', category: 'accounting', displayName: 'QuickBooks' }];
      service.loadProviders();
      const req = httpMock.expectOne(`${baseUrl}/providers`);
      expect(req.request.method).toBe('GET');
      req.flush(mockProviders);
      expect(service.providers()).toEqual(mockProviders as any);
    });
  });

  describe('create', () => {
    it('should POST new integration and reload integrations', () => {
      const request = {
        category: 'accounting',
        providerId: 'qbo',
        displayName: 'My QB',
        credentialsJson: '{}',
      };
      service.create(request).subscribe();
      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ id: 1 });

      // tap triggers loadIntegrations reload
      const reload = httpMock.expectOne(baseUrl);
      reload.flush([]);
    });
  });

  describe('disconnect', () => {
    it('should DELETE integration and reload', () => {
      service.disconnect(3).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      const reload = httpMock.expectOne(baseUrl);
      reload.flush([]);
    });
  });

  describe('testConnection', () => {
    it('should POST test connection', () => {
      service.testConnection(2).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/2/test`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true });
    });
  });

  describe('updateCredentials', () => {
    it('should PUT credentials', () => {
      service.updateCredentials(4, '{"key":"value"}').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/4/credentials`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ credentialsJson: '{"key":"value"}' });
      req.flush(null);
    });
  });

  describe('updateConfig', () => {
    it('should PUT config', () => {
      service.updateConfig(4, '{"setting":true}').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/4/config`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ configJson: '{"setting":true}' });
      req.flush(null);
    });

    it('should handle null config', () => {
      service.updateConfig(4, null).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/4/config`);
      expect(req.request.body).toEqual({ configJson: null });
      req.flush(null);
    });
  });
});
