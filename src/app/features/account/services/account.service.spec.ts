import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AccountService, UpdateProfileRequest, ChangePasswordRequest } from './account.service';
import { environment } from '../../../../environments/environment';

describe('AccountService', () => {
  let service: AccountService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/auth`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('updateProfile', () => {
    it('should PUT profile data', () => {
      const request: UpdateProfileRequest = {
        firstName: 'John',
        lastName: 'Doe',
        initials: 'JD',
        avatarColor: '#ff0000',
      };
      service.updateProfile(request).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/profile`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush({});
    });
  });

  describe('changePassword', () => {
    it('should POST password change', () => {
      const request: ChangePasswordRequest = {
        currentPassword: 'old123',
        newPassword: 'new456',
      };
      service.changePassword(request).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/change-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(null);
    });
  });
});
