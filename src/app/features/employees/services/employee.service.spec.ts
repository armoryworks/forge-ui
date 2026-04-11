import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EmployeeService } from './employee.service';
import { environment } from '../../../../environments/environment';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/employees`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EmployeeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getEmployees', () => {
    it('should GET employees list', () => {
      service.getEmployees().subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass search filter', () => {
      service.getEmployees({ search: 'Smith' }).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('search')).toBe('Smith');
      req.flush([]);
    });

    it('should pass teamId filter', () => {
      service.getEmployees({ teamId: 5 }).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('teamId')).toBe('5');
      req.flush([]);
    });

    it('should pass role filter', () => {
      service.getEmployees({ role: 'Engineer' }).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('role')).toBe('Engineer');
      req.flush([]);
    });

    it('should pass isActive filter', () => {
      service.getEmployees({ isActive: true }).subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('isActive')).toBe('true');
      req.flush([]);
    });
  });

  describe('getEmployee', () => {
    it('should GET employee detail', () => {
      service.getEmployee(10).subscribe();
      const req = httpMock.expectOne(`${base}/10`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 10 });
    });
  });

  describe('getEmployeeStats', () => {
    it('should GET employee stats', () => {
      service.getEmployeeStats(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/stats`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getTimeSummary', () => {
    it('should GET time summary without period', () => {
      service.getTimeSummary(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/time-summary`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass period param', () => {
      service.getTimeSummary(10, 'this-week').subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/10/time-summary`);
      expect(req.request.params.get('period')).toBe('this-week');
      req.flush([]);
    });
  });

  describe('getPaySummary', () => {
    it('should GET pay summary', () => {
      service.getPaySummary(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/pay-summary`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getJobs', () => {
    it('should GET employee jobs', () => {
      service.getJobs(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/jobs`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getExpenses', () => {
    it('should GET employee expenses', () => {
      service.getExpenses(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/expenses`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getTraining', () => {
    it('should GET employee training', () => {
      service.getTraining(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/training`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getCompliance', () => {
    it('should GET employee compliance', () => {
      service.getCompliance(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/compliance`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getActivity', () => {
    it('should GET employee activity', () => {
      service.getActivity(10).subscribe();
      const req = httpMock.expectOne(`${base}/10/activity`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
