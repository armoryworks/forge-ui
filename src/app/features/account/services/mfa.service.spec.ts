import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { of } from 'rxjs';

import { MfaService } from './mfa.service';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';

describe('MfaService', () => {
  let service: MfaService;
  let httpMock: HttpTestingController;
  let auth: { refreshAccessToken: ReturnType<typeof vi.fn> };
  const base = `${environment.apiUrl}`;

  beforeEach(() => {
    auth = { refreshAccessToken: vi.fn(() => of('fresh-token')) };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }],
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

    it('swaps in a fresh token once the device is verified, so an MFA-required role is no longer held to enrolment', () => {
      let result: { verified: boolean } | undefined;
      service.verifySetup(1, '123456').subscribe(res => { result = res; });
      httpMock.expectOne(`${base}/auth/mfa/verify-setup`).flush({ verified: true });

      expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ verified: true });
    });

    it('keeps the current token when the code is wrong', () => {
      service.verifySetup(1, '000000').subscribe();
      httpMock.expectOne(`${base}/auth/mfa/verify-setup`).flush({ verified: false });

      expect(auth.refreshAccessToken).not.toHaveBeenCalled();
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
    it('should POST to /auth/mfa/challenge with the pre-auth token', () => {
      const mockChallenge = { challengeToken: 'tok123', hint: 'My Phone' };
      service.createChallenge('pending-abc').subscribe(res => {
        expect(res).toEqual(mockChallenge);
      });
      const req = httpMock.expectOne(`${base}/auth/mfa/challenge`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ mfaPendingToken: 'pending-abc' });
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

  describe('getPolicy', () => {
    it('should GET /admin/mfa/policy and return the stored roles', () => {
      service.getPolicy().subscribe(res => {
        expect(res).toEqual({ requiredRoles: ['Controller'] });
      });
      const req = httpMock.expectOne(`${base}/admin/mfa/policy`);
      expect(req.request.method).toBe('GET');
      req.flush({ requiredRoles: ['Controller'] });
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
