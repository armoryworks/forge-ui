import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MfaService } from './mfa.service';
import { environment } from '../../../../environments/environment';

describe('MfaService', () => {
  let service: MfaService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MfaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { httpMock.verify(); });

  describe('beginSetup', () => {
    it('should POST to /auth/mfa/setup with deviceName', () => {
      const mockResponse = { deviceId: 1, totpUri: 'otpauth://...', qrCodeBase64: 'abc' };
      service.beginSetup('My Phone').subscribe(res => {
        expect(res).toEqual(mockResponse);
      });
      const req = httpMock.expectOne(`${base}/auth/mfa/setup`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ deviceName: 'My Phone' });
      req.flush(mockResponse);
    });

    it('should POST to /auth/mfa/setup without deviceName', () => {
      service.beginSetup().subscribe();
      const req = httpMock.expectOne(`${base}/auth/mfa/setup`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ deviceName: undefined });
      req.flush({ deviceId: 2, totpUri: '', qrCodeBase64: '' });
    });
  });

  describe('verifySetup', () => {
    it('should POST to /auth/mfa/verify-setup with deviceId and code', () => {
      service.verifySetup(1, '123456').subscribe(res => {
        expect(res).toEqual({ verified: true });
      });
      const req = httpMock.expectOne(`${base}/auth/mfa/verify-setup`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ deviceId: 1, code: '123456' });
      req.flush({ verified: true });
    });
  });

  describe('disable', () => {
    it('should DELETE /auth/mfa/disable and set status signal to null', () => {
      service.disable().subscribe();
      const req = httpMock.expectOne(`${base}/auth/mfa/disable`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      expect(service.status()).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should GET /auth/mfa/status and update status signal', () => {
      const mockStatus = { isEnabled: true, devices: [], hasRecoveryCodes: true };
      service.getStatus().subscribe(res => {
        expect(res).toEqual(mockStatus);
      });
      const req = httpMock.expectOne(`${base}/auth/mfa/status`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);
      expect(service.status()).toEqual(mockStatus as any);
    });
  });

  describe('createChallenge', () => {
    it('should POST to /auth/mfa/challenge with userId', () => {
      const mockChallenge = { challengeToken: 'tok123', hint: 'My Phone' };
      service.createChallenge(42).subscribe(res => {
        expect(res).toEqual(mockChallenge);
      });
      const req = httpMock.expectOne(`${base}/auth/mfa/challenge`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ userId: 42 });
      req.flush(mockChallenge);
    });
  });

  describe('validateChallenge', () => {
    it('should POST to /auth/mfa/validate with the full request body', () => {
      const request = { challengeToken: 'tok123', code: '654321' };
      const mockResponse = { accessToken: 'jwt', refreshToken: 'rtok' };
      service.validateChallenge(request as any).subscribe(res => {
        expect(res).toEqual(mockResponse);
      });
      const req = httpMock.expectOne(`${base}/auth/mfa/validate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });
  });

  describe('getCompliance', () => {
    it('should GET /admin/mfa/compliance and return compliance users', () => {
      const mockCompliance = [{ userId: 1, email: 'a@b.com', hasMfa: true }];
      service.getCompliance().subscribe(res => {
        expect(res).toEqual(mockCompliance);
      });
      const req = httpMock.expectOne(`${base}/admin/mfa/compliance`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCompliance);
    });
  });

  describe('setPolicy', () => {
    it('should PUT /admin/mfa/policy with requiredRoles', () => {
      service.setPolicy(['Admin', 'Manager']).subscribe();
      const req = httpMock.expectOne(`${base}/admin/mfa/policy`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ requiredRoles: ['Admin', 'Manager'] });
      req.flush(null);
    });
  });
});
