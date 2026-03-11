import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ExpensesService } from './expenses.service';
import { environment } from '../../../../environments/environment';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/expenses`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ExpensesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getExpenses ───────────────────────────────────────────────────────────

  describe('getExpenses', () => {
    it('should GET expenses without filters', () => {
      let result: unknown[] = [];
      service.getExpenses().subscribe((items) => { result = items; });

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([{ id: 1, description: 'Office supplies', amount: 45.00 }]);

      expect(result.length).toBe(1);
    });

    it('should include userId and status query params when provided', () => {
      service.getExpenses(10, 'Approved' as any, 'office').subscribe();

      const req = httpMock.expectOne((r) => r.url === baseUrl);
      expect(req.request.params.get('userId')).toBe('10');
      expect(req.request.params.get('status')).toBe('Approved');
      expect(req.request.params.get('search')).toBe('office');
      req.flush([]);
    });
  });

  // ── createExpense ─────────────────────────────────────────────────────────

  describe('createExpense', () => {
    it('should POST a new expense and return the item', () => {
      const request = { description: 'New expense', amount: 99.99, category: 'Travel' } as any;
      const mockResponse = { id: 2, description: 'New expense', amount: 99.99 };
      let result: unknown = null;

      service.createExpense(request).subscribe((item) => { result = item; });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── updateExpenseStatus ───────────────────────────────────────────────────

  describe('updateExpenseStatus', () => {
    it('should PATCH the expense status', () => {
      const request = { status: 'Approved', notes: 'Looks good' } as any;
      const mockResponse = { id: 1, status: 'Approved' };
      let result: unknown = null;

      service.updateExpenseStatus(1, request).subscribe((item) => { result = item; });

      const req = httpMock.expectOne(`${baseUrl}/1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  // ── deleteExpense ─────────────────────────────────────────────────────────

  describe('deleteExpense', () => {
    it('should DELETE the specified expense', () => {
      let completed = false;
      service.deleteExpense(1).subscribe(() => { completed = true; });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── getSettings ───────────────────────────────────────────────────────────

  describe('getSettings', () => {
    it('should GET expense settings', () => {
      const mockSettings = { requireReceipt: true, approvalThreshold: 100 };
      let result: unknown = null;

      service.getSettings().subscribe((s) => { result = s; });

      const req = httpMock.expectOne(`${baseUrl}/settings`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSettings);

      expect(result).toEqual(mockSettings);
    });
  });

  // ── getRecurringExpenses ──────────────────────────────────────────────────

  describe('getRecurringExpenses', () => {
    it('should GET recurring expenses', () => {
      let result: unknown[] = [];
      service.getRecurringExpenses().subscribe((items) => { result = items; });

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/recurring`);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 1, description: 'Monthly subscription' }]);

      expect(result.length).toBe(1);
    });
  });
});
