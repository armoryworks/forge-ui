import {
  HttpClient,
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
import { httpErrorInterceptor } from './http-error.interceptor';

describe('httpErrorInterceptor — capability-gate resilience', () => {
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
});
