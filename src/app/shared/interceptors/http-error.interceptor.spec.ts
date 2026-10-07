import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { CapabilityDisabledError } from '../errors/capability-disabled.error';
import { SnackbarService } from '../services/snackbar.service';
import { ToastService } from '../services/toast.service';
import { wasHttpErrorShown } from '../utils/shown-http-errors';
import { httpErrorInterceptor, SUPPRESS_VALIDATION_SNACKBAR } from './http-error.interceptor';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let snackbar: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let toast: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackbar = {
      error: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
    };
    toast = { show: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: SnackbarService, useValue: snackbar },
        { provide: ToastService, useValue: toast },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('throws CapabilityDisabledError on 403 with capability-disabled envelope and does NOT show snackbar', () => {
    let captured: unknown;
    http.get('/api/v1/ai/status').subscribe({
      next: () => {},
      error: (err) => { captured = err; },
    });

    const req = httpMock.expectOne('/api/v1/ai/status');
    req.flush(
      {
        errors: [{
          code: 'capability-disabled',
          capability: 'CAP-EXT-AI-ASSISTANT',
          message: 'AI is disabled.',
        }],
      },
      { status: 403, statusText: 'Forbidden', headers: { 'X-Capability-Disabled': 'CAP-EXT-AI-ASSISTANT' } },
    );

    expect(captured).toBeInstanceOf(CapabilityDisabledError);
    expect((captured as CapabilityDisabledError).capabilityCode).toBe('CAP-EXT-AI-ASSISTANT');
    expect((captured as CapabilityDisabledError).message).toBe('AI is disabled.');
    expect(snackbar.error).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('throws CapabilityDisabledError when only the X-Capability-Disabled header is present (defensive)', () => {
    let captured: unknown;
    http.get('/api/v1/announcements').subscribe({
      next: () => {},
      error: (err) => { captured = err; },
    });

    const req = httpMock.expectOne('/api/v1/announcements');
    req.flush(
      'forbidden',
      { status: 403, statusText: 'Forbidden', headers: { 'X-Capability-Disabled': 'CAP-EXT-ANNOUNCEMENTS' } },
    );

    expect(captured).toBeInstanceOf(CapabilityDisabledError);
    expect((captured as CapabilityDisabledError).capabilityCode).toBe('CAP-EXT-ANNOUNCEMENTS');
    expect(snackbar.error).not.toHaveBeenCalled();
  });

  it('falls back to access-denied snackbar on plain 403 (no capability envelope, no header)', () => {
    let captured: unknown;
    http.get('/api/v1/admin/secret').subscribe({
      next: () => {},
      error: (err) => { captured = err; },
    });

    const req = httpMock.expectOne('/api/v1/admin/secret');
    req.flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(snackbar.error).toHaveBeenCalledWith('errors.accessDenied');
    expect(captured).toBeInstanceOf(HttpErrorResponse);
    expect(captured).not.toBeInstanceOf(CapabilityDisabledError);
  });

  it('falls back to access-denied snackbar when 403 envelope has a different code', () => {
    let captured: unknown;
    http.get('/api/v1/admin/secret').subscribe({
      next: () => {},
      error: (err) => { captured = err; },
    });

    const req = httpMock.expectOne('/api/v1/admin/secret');
    req.flush(
      { errors: [{ code: 'access-denied', message: 'No' }] },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(snackbar.error).toHaveBeenCalledWith('errors.accessDenied');
    expect(captured).not.toBeInstanceOf(CapabilityDisabledError);
  });

  it('still triggers 500 toast for non-403 errors (regression check — interceptor unchanged for other paths)', () => {
    http.get('/api/v1/jobs/1').subscribe({
      next: () => {},
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/jobs/1');
    req.flush({ detail: 'Server exploded' }, { status: 500, statusText: 'Server Error' });

    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', message: 'Server exploded' }),
    );
  });

  it('shows the detail of a 400 validation problem instead of its generic title', () => {
    http.post('/api/v1/parts', {}).subscribe({
      next: () => {},
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/parts');
    req.flush(
      {
        type: 'about:blank',
        title: 'Validation failed',
        status: 400,
        detail: 'Manual part numbers are turned off.',
        errors: { partNumber: ['Manual part numbers are turned off.'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(snackbar.error).toHaveBeenCalledWith('Manual part numbers are turned off.');
  });

  describe('400 validation errors', () => {
    const handlerValidatorBody = {
      status: 400,
      title: 'Validation failed',
      detail: 'Quantity must be greater than zero.',
      errors: [{ field: 'quantity', message: 'Quantity must be greater than zero.', rejectedValue: '0' }],
    };

    function post(context?: HttpContext): () => unknown {
      let captured: unknown;
      http.post('/api/v1/sales-orders', {}, { context }).subscribe({
        next: () => {},
        error: (err) => { captured = err; },
      });
      return () => captured;
    }

    it('shows the server detail when no form handles the error', () => {
      const captured = post();
      httpMock.expectOne('/api/v1/sales-orders')
        .flush(handlerValidatorBody, { status: 400, statusText: 'Bad Request' });

      expect(snackbar.error).toHaveBeenCalledWith('Quantity must be greater than zero.');
      expect(wasHttpErrorShown(captured())).toBe(true);
    });

    it('falls back to the first field message when the envelope has no detail', () => {
      post();
      httpMock.expectOne('/api/v1/sales-orders').flush(
        { errors: [{ field: 'dueDate', message: 'Date is not valid', rejectedValue: '2025-02-29' }] },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(snackbar.error).toHaveBeenCalledWith('Date is not valid');
    });

    it('stays quiet when the caller applies the field errors to its form', () => {
      const captured = post(new HttpContext().set(SUPPRESS_VALIDATION_SNACKBAR, true));
      httpMock.expectOne('/api/v1/sales-orders')
        .flush(handlerValidatorBody, { status: 400, statusText: 'Bad Request' });

      expect(snackbar.error).not.toHaveBeenCalled();
      expect(wasHttpErrorShown(captured())).toBe(false);
    });

    it('still shows a non-envelope 400 even when the caller handles field errors', () => {
      post(new HttpContext().set(SUPPRESS_VALIDATION_SNACKBAR, true));
      httpMock.expectOne('/api/v1/sales-orders').flush(
        { title: 'Bad request', detail: 'Ship date cannot precede the order date.' },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(snackbar.error).toHaveBeenCalledWith('Ship date cannot precede the order date.');
    });
  });

  describe('409 conflicts', () => {
    it('titles a business-rule rejection with the rule-violation key', () => {
      let captured: unknown;
      http.delete('/api/v1/sales-orders/4').subscribe({ error: (err) => { captured = err; } });
      httpMock.expectOne('/api/v1/sales-orders/4').flush(
        { title: 'Action not allowed', detail: 'Cannot delete order with active shipments', code: 'business-rule' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'warning',
        title: 'errors.ruleViolation',
        message: 'Cannot delete order with active shipments',
      }));
      expect(wasHttpErrorShown(captured)).toBe(true);
    });

    it('keeps the conflict title for other 409s', () => {
      http.post('/api/v1/invoices', {}).subscribe({ error: () => {} });
      httpMock.expectOne('/api/v1/invoices').flush(
        { title: 'Duplicate number', detail: 'That number was just taken by another record. Save again to get the next number.', code: 'duplicate' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'errors.conflict',
        message: 'That number was just taken by another record. Save again to get the next number.',
      }));
    });
  });
});
