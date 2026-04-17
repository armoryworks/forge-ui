import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TranslateService } from '@ngx-translate/core';

import { QuickBooksService } from './quickbooks.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { environment } from '../../../../environments/environment';

describe('QuickBooksService', () => {
  let service: QuickBooksService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  const mockSnackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const mockTranslate = { instant: vi.fn((key: string) => key) };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SnackbarService, useValue: mockSnackbar },
        { provide: TranslateService, useValue: mockTranslate },
      ],
    });
    service = TestBed.inject(QuickBooksService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('loadStatus', () => {
    it('should GET quickbooks status and update signal', () => {
      const mockStatus = {
        isConnected: true,
        companyId: '123',
        companyName: 'Test Co',
        connectedAt: null,
        tokenExpiresAt: null,
        lastSyncAt: null,
      };

      service.loadStatus();

      expect(service.loading()).toBe(true);

      const req = httpMock.expectOne(`${apiUrl}/quickbooks/status`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);

      expect(service.status()).toEqual(mockStatus);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should set error signal on failure', () => {
      service.loadStatus();

      const req = httpMock.expectOne(`${apiUrl}/quickbooks/status`);
      req.flush('error', { status: 500, statusText: 'Server Error' });

      expect(service.loading()).toBe(false);
      expect(service.error()).toBeTruthy();
    });
  });

  describe('connect', () => {
    it('should GET authorize URL', () => {
      service.connect();

      expect(service.loading()).toBe(true);

      const req = httpMock.expectOne(`${apiUrl}/quickbooks/authorize`);
      expect(req.request.method).toBe('GET');
      // Don't flush with a real URL to avoid navigation side effect
    });
  });

  describe('disconnect', () => {
    it('should POST to accounting/disconnect and reset status', () => {
      service.disconnect();

      expect(service.loading()).toBe(true);

      const req = httpMock.expectOne(`${apiUrl}/accounting/disconnect`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);

      expect(service.status()?.isConnected).toBe(false);
      expect(service.loading()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should POST to accounting/test', () => {
      service.testConnection();

      expect(service.loading()).toBe(true);

      const req = httpMock.expectOne(`${apiUrl}/accounting/test`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ success: true, companyName: 'Test Co' });

      expect(service.loading()).toBe(false);
    });
  });
});
