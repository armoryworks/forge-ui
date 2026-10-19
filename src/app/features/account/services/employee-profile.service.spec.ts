import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { completenessItemStatus, EmployeeProfileService, EmployeeProfile, ProfileCompleteness, UpdateEmployeeProfileRequest } from './employee-profile.service';
import { environment } from '../../../../environments/environment';

describe('EmployeeProfileService', () => {
  let service: EmployeeProfileService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/employee-profile`;

  const mockProfile: EmployeeProfile = {
    id: 1,
    userId: 10,
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    street1: '123 Main St',
    street2: null,
    city: 'Springfield',
    state: 'OH',
    zipCode: '45501',
    country: 'US',
    phoneNumber: '(555) 123-4567',
    personalEmail: 'john@example.com',
    emergencyContactName: 'Jane Doe',
    emergencyContactPhone: '(555) 987-6543',
    emergencyContactRelationship: 'Spouse',
    startDate: '2023-01-15',
    department: 'Engineering',
    jobTitle: 'Machinist',
    employeeNumber: 'EMP001',
    payType: 'Hourly',
    hourlyRate: 25.0,
    salaryAmount: null,
    w4CompletedAt: '2023-01-15',
    stateWithholdingCompletedAt: null,
    i9CompletedAt: '2023-01-15',
    i9ExpirationDate: null,
    directDepositCompletedAt: null,
    workersCompAcknowledgedAt: null,
    handbookAcknowledgedAt: null,
  };

  const mockCompleteness: ProfileCompleteness = {
    isComplete: false,
    canBeAssignedJobs: true,
    totalItems: 8,
    completedItems: 5,
    items: [
      { key: 'address', label: 'Address', isComplete: true, blocksJobAssignment: false },
      { key: 'w4', label: 'W-4', isComplete: true, blocksJobAssignment: true },
      { key: 'directDeposit', label: 'Direct Deposit', isComplete: false, blocksJobAssignment: false },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EmployeeProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('load', () => {
    it('should GET profile and completeness', () => {
      service.load();

      const profileReq = httpMock.expectOne(base);
      expect(profileReq.request.method).toBe('GET');
      profileReq.flush(mockProfile);

      const completenessReq = httpMock.expectOne(`${base}/completeness`);
      expect(completenessReq.request.method).toBe('GET');
      completenessReq.flush(mockCompleteness);

      expect(service.profile()).toEqual(mockProfile);
      expect(service.completeness()).toEqual(mockCompleteness);
    });
  });

  describe('updateProfile', () => {
    it('should PUT profile and refresh completeness', () => {
      const request: UpdateEmployeeProfileRequest = {
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        street1: '456 Oak Ave',
        street2: null,
        city: 'Dayton',
        state: 'OH',
        zipCode: '45402',
        country: 'US',
        phoneNumber: '(555) 111-2222',
        personalEmail: 'john@test.com',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '(555) 333-4444',
        emergencyContactRelationship: 'Spouse',
      };

      service.updateProfile(request).subscribe();

      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(mockProfile);

      // tap triggers refreshCompleteness
      const completenessReq = httpMock.expectOne(`${base}/completeness`);
      completenessReq.flush(mockCompleteness);

      expect(service.profile()).toEqual(mockProfile);
    });
  });

  describe('acknowledgeForm', () => {
    it('should POST acknowledge and refresh profile + completeness', () => {
      service.acknowledgeForm('handbook').subscribe();

      const req = httpMock.expectOne(`${base}/acknowledge/handbook`);
      expect(req.request.method).toBe('POST');
      req.flush(null);

      // tap triggers refreshCompleteness and profile reload
      const completenessReq = httpMock.expectOne(`${base}/completeness`);
      completenessReq.flush(mockCompleteness);

      const profileReq = httpMock.expectOne(base);
      profileReq.flush(mockProfile);
    });
  });

  describe('computed signals', () => {
    it('should compute isComplete from completeness', () => {
      expect(service.isComplete()).toBe(false);

      service.load();
      httpMock.expectOne(base).flush(mockProfile);
      httpMock.expectOne(`${base}/completeness`).flush({ ...mockCompleteness, isComplete: true });

      expect(service.isComplete()).toBe(true);
    });

    it('should compute incompleteCount', () => {
      expect(service.incompleteCount()).toBe(0);

      service.load();
      httpMock.expectOne(base).flush(mockProfile);
      httpMock.expectOne(`${base}/completeness`).flush(mockCompleteness);

      expect(service.incompleteCount()).toBe(3); // 8 - 5
    });

    it('should compute canBeAssignedJobs', () => {
      expect(service.canBeAssignedJobs()).toBe(false);

      service.load();
      httpMock.expectOne(base).flush(mockProfile);
      httpMock.expectOne(`${base}/completeness`).flush(mockCompleteness);

      expect(service.canBeAssignedJobs()).toBe(true);
    });

    it('should compute firstIncompleteRoute', () => {
      expect(service.firstIncompleteRoute()).toBe('/account/profile');

      service.load();
      httpMock.expectOne(base).flush(mockProfile);
      httpMock.expectOne(`${base}/completeness`).flush({
        ...mockCompleteness,
        items: [
          { key: 'address', label: 'Address', isComplete: true, blocksJobAssignment: false },
          { key: 'directDeposit', label: 'Direct Deposit', isComplete: false, blocksJobAssignment: false },
        ],
      });

      expect(service.firstIncompleteRoute()).toBe('/account/tax-forms/directDeposit');
    });
  });

  describe('incompleteSectionCount', () => {
    it('counts the tax forms section from the camelCase keys the API emits', () => {
      service.load();
      httpMock.expectOne(base).flush(mockProfile);
      httpMock.expectOne(`${base}/completeness`).flush({
        isComplete: false, canBeAssignedJobs: true, totalItems: 3, completedItems: 2,
        items: [
          { key: 'address', label: 'Home Address', isComplete: true, blocksJobAssignment: false },
          { key: 'emergency_contact', label: 'Emergency Contact', isComplete: true, blocksJobAssignment: true },
          { key: 'stateWithholding', label: 'State', isComplete: false, blocksJobAssignment: true },
        ],
      } satisfies ProfileCompleteness);

      expect(service.incompleteSectionCount()).toBe(1);
    });
  });
});

describe('completenessItemStatus', () => {
  const bypassed: ProfileCompleteness = { isComplete: true, canBeAssignedJobs: true, totalItems: 8, completedItems: 8, items: [] };

  it('treats an item missing from a complete profile (onboarding bypassed) as complete', () => {
    expect(completenessItemStatus(bypassed, 'w4')).toBe(true);
  });

  it('reports the item itself when the API lists it', () => {
    const partial: ProfileCompleteness = {
      isComplete: false, canBeAssignedJobs: false, totalItems: 1, completedItems: 0,
      items: [{ key: 'w4', label: 'W-4', isComplete: false, blocksJobAssignment: true }],
    };
    expect(completenessItemStatus(partial, 'w4')).toBe(false);
    expect(completenessItemStatus(partial, 'i9')).toBeNull();
  });

  it('is unknown until completeness loads', () => {
    expect(completenessItemStatus(null, 'w4')).toBeNull();
  });
});
