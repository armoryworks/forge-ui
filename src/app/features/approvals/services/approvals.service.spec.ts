import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApprovalsService } from './approvals.service';
import { environment } from '../../../../environments/environment';

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApprovalsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPendingApprovals', () => {
    it('should GET pending approvals', () => {
      service.getPendingApprovals().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/pending`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getApprovalHistory', () => {
    it('should GET approval history for entity', () => {
      service.getApprovalHistory('expense', 12).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/history/expense/12`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('submitForApproval', () => {
    it('should POST submit for approval', () => {
      const body = { entityType: 'expense', entityId: 5, amount: 250 };
      service.submitForApproval(body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/submit`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('approve', () => {
    it('should POST approve with comments', () => {
      service.approve(3, 'Looks good').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/3/approve`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ comments: 'Looks good' });
      req.flush({ id: 3 });
    });

    it('should POST approve without comments', () => {
      service.approve(3).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/3/approve`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ comments: undefined });
      req.flush({ id: 3 });
    });
  });

  describe('reject', () => {
    it('should POST reject with comments', () => {
      service.reject(4, 'Over budget').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/4/reject`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ comments: 'Over budget' });
      req.flush({ id: 4 });
    });
  });

  describe('delegate', () => {
    it('should POST delegate to another user', () => {
      service.delegate(5, 10, 'Please review').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/5/delegate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ delegateToUserId: 10, comments: 'Please review' });
      req.flush(null);
    });
  });

  describe('getWorkflows', () => {
    it('should GET workflows', () => {
      service.getWorkflows().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/workflows`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createWorkflow', () => {
    it('should POST new workflow', () => {
      const body = { name: 'Expense Approval', entityType: 'expense', steps: [{ order: 1 }] } as any;
      service.createWorkflow(body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/workflows`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 1 });
    });
  });

  describe('updateWorkflow', () => {
    it('should PUT workflow update', () => {
      const body = { name: 'Updated', entityType: 'expense', steps: [] } as any;
      service.updateWorkflow(2, body).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/approvals/workflows/2`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({ id: 2 });
    });
  });
});
