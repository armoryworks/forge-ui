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
import { LayoutService } from '../services/layout.service';
import { SnackbarService } from '../services/snackbar.service';
import { ToastService } from '../services/toast.service';
import { wasHttpErrorShown } from '../utils/shown-http-errors';
import { httpErrorInterceptor, MFA_ENROLLMENT_REQUIRED, SUPPRESS_VALIDATION_SNACKBAR } from './http-error.interceptor';
import { SILENT_HTTP_ERRORS } from './silent-http-errors.token';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let snackbar: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let toast: { show: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let mfaRoute: string;
  let language: string;
  let catalog: Record<string, string>;

  beforeEach(() => {
    language = 'en';
    catalog = {};
    snackbar = {
      error: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
    };
    toast = { show: vi.fn() };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    mfaRoute = '/account/security';

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: SnackbarService, useValue: snackbar },
        { provide: ToastService, useValue: toast },
        {
          provide: TranslateService,
          useValue: {
            instant: (k: string, p?: Record<string, unknown>) =>
              (catalog[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(p?.[n] ?? '')),
            getCurrentLang: () => language,
          },
        },
        { provide: Router, useValue: router },
        { provide: LayoutService, useValue: { getMfaEnrollmentRoute: () => mfaRoute } },
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

  it('sends a user who must enrol in MFA to the security page instead of showing access denied', () => {
    let captured: unknown;
    http.get('/api/v1/jobs').subscribe({
      next: () => {},
      error: (err) => { captured = err; },
    });

    const req = httpMock.expectOne('/api/v1/jobs');
    req.flush({ status: 403, code: MFA_ENROLLMENT_REQUIRED }, { status: 403, statusText: 'Forbidden' });

    expect(router.navigate).toHaveBeenCalledWith(['/account/security']);
    expect(snackbar.error).not.toHaveBeenCalled();
    expect(captured).toBeInstanceOf(HttpErrorResponse);
    expect(wasHttpErrorShown(captured)).toBe(true);
  });

  it('keeps a mobile-shell user who must enrol in MFA inside the mobile shell', () => {
    mfaRoute = '/m/account/security';
    http.get('/api/v1/jobs').subscribe({ next: () => {}, error: () => {} });

    httpMock.expectOne('/api/v1/jobs').flush({ status: 403, code: MFA_ENROLLMENT_REQUIRED }, { status: 403, statusText: 'Forbidden' });

    expect(router.navigate).toHaveBeenCalledWith(['/m/account/security']);
    expect(snackbar.error).not.toHaveBeenCalled();
  });

  it('words a missing exchange rate with the pair and the date', () => {
    catalog['apiErrors.codes.fxRateMissing'] = 'No rate {{from}} to {{to}} on {{date}}';
    http.post('/api/v1/invoices', {}).subscribe({ error: () => {} });

    httpMock.expectOne('/api/v1/invoices').flush(
      { code: 'fx-rate-missing', fromCurrency: 'CAD', toCurrency: 'USD', date: '2026-10-26' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(snackbar.error).toHaveBeenCalledWith('No rate CAD to USD on 10/26/2026');
  });

  it('stays quiet on other 422 problems', () => {
    http.post('/api/v1/parts/1/routing/graph', {}).subscribe({ error: () => {} });

    httpMock.expectOne('/api/v1/parts/1/routing/graph').flush(
      { code: 'routing-graph-invalid' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(snackbar.error).not.toHaveBeenCalled();
  });

  it('words a currency lock conflict', () => {
    catalog['apiErrors.codes.partyCurrencyLocked'] = 'Currency locked';
    http.put('/api/v1/customers/1', {}).subscribe({ error: () => {} });

    httpMock.expectOne('/api/v1/customers/1').flush(
      { code: 'party-currency-locked', detail: 'server text' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Currency locked' }));
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

  describe('500 toast details', () => {
    const flush500 = (body: string | object | null) => {
      http.get('/api/v1/jobs/1').subscribe({ next: () => {}, error: () => {} });
      httpMock.expectOne('/api/v1/jobs/1').flush(body, { status: 500, statusText: 'Server Error' });
      return toast.show.mock.calls[0][0] as { message: string; details?: string };
    };

    it('keeps the detail and adds the trace id when the problem carries both', () => {
      const shown = flush500({ title: 'Boom', detail: 'Server exploded', traceId: '00-abc-01' });
      expect(shown.message).toBe('Server exploded');
      expect(shown.details).toBe('Server exploded\ntraceId: 00-abc-01');
    });

    it('shows only the trace id for a bare problem body instead of a JSON blob', () => {
      const shown = flush500({ type: 'https://tools.ietf.org/html/rfc9110#section-15.6.1', title: 'An error occurred', status: 500, traceId: '00-def-01' });
      expect(shown.message).toBe('An error occurred');
      expect(shown.details).toBe('traceId: 00-def-01');
    });

    it('keeps the full body for the copy button when it carries validation errors', () => {
      const body = { title: 'Boom', status: 500, traceId: '00-ghi-01', errors: { Name: ['Required'] } };
      const shown = flush500(body);
      expect(shown.details).toBe(JSON.stringify(body, null, 2));
    });

    it('keeps the full body for the copy button when it carries a stack trace', () => {
      const body = { title: 'Boom', detail: 'Server exploded', stackTrace: 'at Forge.Api.Foo()' };
      const shown = flush500(body);
      expect(shown.details).toBe(JSON.stringify(body, null, 2));
    });

    it('adds no details for a plain string body', () => {
      const shown = flush500('upstream timeout');
      expect(shown.message).toBe('upstream timeout');
      expect(shown.details).toBeUndefined();
    });

    it('falls back to the generic message with no details for an empty body', () => {
      const shown = flush500(null);
      expect(shown.message).toBe('errors.unexpectedError');
      expect(shown.details).toBeUndefined();
    });
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

    it('words coded field errors in Spanish when the UI is in Spanish', () => {
      language = 'es';
      catalog = {
        'apiErrors.validators.maxLength': '{{field}} debe tener {{maxLength}} caracteres o menos.',
        'apiErrors.codes.leadNameRequired': 'Indique un nombre de empresa o un nombre de contacto.',
        'common.name': 'Nombre',
      };
      post();
      httpMock.expectOne('/api/v1/sales-orders').flush(
        {
          status: 400,
          detail: 'Name must be 200 characters or fewer. Provide a company name or a contact name.',
          errors: [
            { field: 'data.name', message: 'Name must be 200 characters or fewer.', code: 'MaximumLengthValidator', params: { maxLength: 200 } },
            { field: 'data.companyName', message: 'Provide a company name or a contact name.', code: 'lead-name-required' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(snackbar.error).toHaveBeenCalledWith(
        'Nombre debe tener 200 caracteres o menos. Indique un nombre de empresa o un nombre de contacto.');
    });

    it('keeps the server wording in English and for codes the catalog does not word', () => {
      post();
      httpMock.expectOne('/api/v1/sales-orders').flush(
        { detail: 'Quantity must be greater than zero.', errors: [{ field: 'quantity', message: 'Quantity must be greater than zero.', code: 'GreaterThanValidator' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      expect(snackbar.error).toHaveBeenLastCalledWith('Quantity must be greater than zero.');

      language = 'es';
      post();
      httpMock.expectOne('/api/v1/sales-orders').flush(
        { detail: 'predicate must be valid JSON.', errors: [{ field: 'predicate', message: 'predicate must be valid JSON.', code: 'PredicateValidator' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      expect(snackbar.error).toHaveBeenLastCalledWith('predicate must be valid JSON.');
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

  describe('network failures', () => {
    const networkError = new ProgressEvent('error');

    afterEach(() => vi.useRealTimers());

    it('retries a read that never reached the server before reporting it', () => {
      vi.useFakeTimers();
      let result: unknown;
      http.get('/api/v1/jobs').subscribe({ next: (body) => { result = body; } });

      httpMock.expectOne('/api/v1/jobs').error(networkError);
      vi.advanceTimersByTime(500);
      httpMock.expectOne('/api/v1/jobs').flush([{ id: 1 }]);

      expect(result).toEqual([{ id: 1 }]);
      expect(toast.show).not.toHaveBeenCalled();
    });

    it('shows the connection-lost toast once the retries are used up', () => {
      vi.useFakeTimers();
      http.get('/api/v1/jobs').subscribe({ error: () => {} });

      httpMock.expectOne('/api/v1/jobs').error(networkError);
      vi.advanceTimersByTime(500);
      httpMock.expectOne('/api/v1/jobs').error(networkError);
      vi.advanceTimersByTime(1500);
      httpMock.expectOne('/api/v1/jobs').error(networkError);

      expect(toast.show).toHaveBeenCalledOnce();
      expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ title: 'errors.connectionLost' }));
    });

    it('does not resend a write that never reached the server', () => {
      http.post('/api/v1/jobs', {}).subscribe({ error: () => {} });

      httpMock.expectOne('/api/v1/jobs').error(networkError);

      httpMock.expectNone('/api/v1/jobs');
      expect(toast.show).toHaveBeenCalledOnce();
    });

    it('leaves an offline device to the offline banner', () => {
      const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      http.post('/api/v1/jobs', {}).subscribe({ error: () => {} });

      httpMock.expectOne('/api/v1/jobs').error(networkError);

      expect(toast.show).not.toHaveBeenCalled();
      online.mockRestore();
    });

    it('stays quiet while the tab is hidden', () => {
      const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      http.post('/api/v1/jobs', {}).subscribe({ error: () => {} });

      httpMock.expectOne('/api/v1/jobs').error(networkError);

      expect(toast.show).not.toHaveBeenCalled();
      visibility.mockRestore();
    });
  });

  it('shows nothing for a request marked silent, and still passes the error on', () => {
    let captured: unknown;
    http.delete('/api/v1/time-tracking/entries/9', { context: new HttpContext().set(SILENT_HTTP_ERRORS, true) })
      .subscribe({ error: (err) => { captured = err; } });

    httpMock.expectOne('/api/v1/time-tracking/entries/9')
      .flush({ detail: 'Entry is locked' }, { status: 409, statusText: 'Conflict' });

    expect(toast.show).not.toHaveBeenCalled();
    expect(snackbar.error).not.toHaveBeenCalled();
    expect(captured).toBeInstanceOf(HttpErrorResponse);
  });
});
