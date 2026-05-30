import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SystemApiKeyService } from './system-api-key.service';
import {
  SystemApiKey,
  CreateSystemApiKeyResponse,
} from '../models/system-api-key.model';
import { environment } from '../../../../environments/environment';

describe('SystemApiKeyService', () => {
  let service: SystemApiKeyService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/admin/system-api-keys`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SystemApiKeyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('list', () => {
    it('GETs the admin system-api-keys endpoint', () => {
      const mock: SystemApiKey[] = [{
        id: 1, name: 'Tuyere', keyPrefix: 'fsk_aaaa', userId: 7,
        userEmail: 'tuyere-cms@forge.local', isActive: true,
        lastUsedAt: null, expiresAt: null, scopes: null, allowedIps: null,
        createdAt: '2026-05-30T00:00:00Z',
      }];
      let result: SystemApiKey[] = [];

      service.list().subscribe((keys) => { result = keys; });
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush(mock);

      expect(result.length).toBe(1);
      expect(result[0].userEmail).toBe('tuyere-cms@forge.local');
    });
  });

  describe('create', () => {
    it('POSTs the request body and returns the one-time plaintext', () => {
      const mockResp: CreateSystemApiKeyResponse = {
        id: 2, name: 'Tuyere', keyPrefix: 'fsk_bbbb',
        plaintextKey: 'fsk_bbbbXXXXYYYYZZZZ', userId: 7, expiresAt: null,
      };
      let result: CreateSystemApiKeyResponse | undefined;

      service.create({ name: 'Tuyere', userId: 7 }).subscribe((r) => { result = r; });
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Tuyere', userId: 7 });
      req.flush(mockResp);

      expect(result?.plaintextKey).toBe('fsk_bbbbXXXXYYYYZZZZ');
    });

    it('forwards roleTemplateId in the payload (forward-compat hook)', () => {
      service.create({ name: 'X', userId: 7, roleTemplateId: 3 }).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.body).toEqual({ name: 'X', userId: 7, roleTemplateId: 3 });
      req.flush({} as CreateSystemApiKeyResponse);
    });
  });

  describe('revoke', () => {
    it('DELETEs at /{id}', () => {
      service.revoke(42).subscribe();
      const req = httpMock.expectOne(`${base}/42`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
