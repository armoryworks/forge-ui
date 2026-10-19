import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { Subject } from 'rxjs';

import { CapabilityDisabledError } from '../../../shared/errors/capability-disabled.error';
import { ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { DesktopPreferenceService } from '../../../shared/services/desktop-preference.service';
import { ScannerService } from '../../../shared/services/scanner.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { markHttpErrorShown } from '../../../shared/utils/shown-http-errors';
import { MobileScanComponent } from './mobile-scan.component';

interface ScanInternals {
  manualValue: { set(v: string): void };
  lastResult: () => ScanResolveResult | null;
  lookupError: () => string | null;
  resolving: () => boolean;
  lookupHandled: () => boolean;
  submitManual(): void;
  openResult(): void;
  resumeScanning(): void;
}

describe('MobileScanComponent', () => {
  const navigate = vi.fn();
  const post = vi.fn();
  const prefer = vi.fn();
  let response: Subject<ScanResolveResult>;
  let component: ScanInternals;

  beforeEach(() => {
    vi.clearAllMocks();
    response = new Subject<ScanResolveResult>();
    post.mockReturnValue(response);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: HttpClient, useValue: { post } },
        provideTranslateService(),
        { provide: ScannerService, useValue: { setContext: vi.fn() } },
        { provide: DesktopPreferenceService, useValue: { prefer } },
        { provide: SnackbarService, useValue: { error: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new MobileScanComponent()) as unknown as ScanInternals;
  });

  const submit = (value: string): void => {
    component.manualValue.set(value);
    component.submitManual();
  };

  it('asks the default-on scanner route to resolve the trimmed code', () => {
    submit('  job-1042 ');
    expect(post).toHaveBeenCalledWith('/api/v1/scanner/resolve', { code: 'job-1042' });
    expect(component.resolving()).toBe(true);
  });

  it('opens the mobile work order for a job', () => {
    submit('job-1042');
    response.next({ kind: 'job', id: 17, code: 'job-1042', label: 'J-1042', subtitle: 'Acme' });

    expect(navigate).toHaveBeenCalledWith(['/m/jobs', 17]);
    expect(component.lastResult()).toBeNull();
  });

  it('shows other kinds in place instead of opening a desktop route', () => {
    const part: ScanResolveResult = { kind: 'part', id: 3, code: 'PRT-9', label: 'PRT-9', subtitle: 'Bracket' };
    submit('PRT-9');
    response.next(part);

    expect(navigate).not.toHaveBeenCalled();
    expect(component.lastResult()).toEqual(part);
    expect(component.resolving()).toBe(false);
  });

  it('keeps an unknown result for the no-match message', () => {
    submit('nope');
    response.next({ kind: 'unknown', id: null, code: 'nope', label: 'nope', subtitle: null });

    expect(navigate).not.toHaveBeenCalled();
    expect(component.lastResult()?.kind).toBe('unknown');
  });

  it('reports a failed lookup as a connection problem', () => {
    submit('JOB-1');
    response.error(new Error('offline'));

    expect(component.lookupError()).toBe('mobileWeb.scan.lookupFailed');
    expect(component.resolving()).toBe(false);
  });

  it('says scanning is turned off when the capability gate refuses the lookup', () => {
    submit('JOB-1');
    response.error(new CapabilityDisabledError('CAP-MFG-SHOPFLOOR', 'This capability is disabled for this installation.'));

    expect(component.lookupError()).toBe('mobileWeb.scan.disabled');
  });

  it('offers Scan Again on a failed lookup and clears the error with it', async () => {
    const fixture = TestBed.createComponent(MobileScanComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const rendered = fixture.componentInstance as unknown as ScanInternals;

    rendered.manualValue.set('JOB-1');
    rendered.submitManual();
    response.error(new Error('offline'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const again = root.querySelector<HTMLButtonElement>('[data-testid="scan-error-again-btn"]');
    expect(again).not.toBeNull();

    again!.click();
    fixture.detectChanges();

    expect(rendered.lookupError()).toBeNull();
    expect(root.querySelector('[data-testid="scan-lookup-error"]')).toBeNull();
  });

  it('leaves the message to the interceptor when it already showed the error', () => {
    const err = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });
    markHttpErrorShown(err);
    submit('JOB-1');
    response.error(err);

    expect(component.lookupError()).toBeNull();
    expect(component.lookupHandled()).toBe(true);
    expect(component.resolving()).toBe(false);
  });

  it('keeps Scan Again on screen after an error the interceptor showed', async () => {
    const fixture = TestBed.createComponent(MobileScanComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const rendered = fixture.componentInstance as unknown as ScanInternals;
    const err = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
    markHttpErrorShown(err);

    rendered.manualValue.set('JOB-1');
    rendered.submitManual();
    response.error(err);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="scan-lookup-error"]')).toBeNull();
    expect(root.querySelector('[data-testid="scan-error-again-btn"]')).not.toBeNull();
  });

  it('refuses a code longer than the server accepts without calling it', () => {
    submit('X'.repeat(201));

    expect(post).not.toHaveBeenCalled();
    expect(component.lookupError()).toBe('mobileWeb.scan.tooLong');
    expect(component.resolving()).toBe(false);
  });

  it('caps the typed code at the server limit', async () => {
    const fixture = TestBed.createComponent(MobileScanComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.componentInstance as unknown as { showManual: { set(v: boolean): void } }).showManual.set(true);
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-testid="scan-manual-input"]')!;
    expect(input.getAttribute('maxlength')).toBe('200');
  });

  it('says a typed code matched nothing differently from a scanned one', async () => {
    const fixture = TestBed.createComponent(MobileScanComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const rendered = fixture.componentInstance as unknown as ScanInternals;

    rendered.manualValue.set('nope');
    rendered.submitManual();
    response.next({ kind: 'unknown', id: null, code: 'nope', label: 'nope', subtitle: null });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="scan-no-match"]')!.textContent!.trim()).toBe('mobileWeb.scan.noMatchTyped');
    expect(root.querySelector('[data-testid="scan-open-btn"]')).toBeNull();
  });

  it('offers to open a resolved part on the desktop site', async () => {
    prefer.mockReturnValue(true);
    const fixture = TestBed.createComponent(MobileScanComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const rendered = fixture.componentInstance as unknown as ScanInternals;

    rendered.manualValue.set('PRT-9');
    rendered.submitManual();
    response.next({ kind: 'part', id: 3, code: 'PRT-9', label: 'PRT-9', subtitle: 'Bracket' });
    fixture.detectChanges();

    const open = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="scan-open-btn"]')!;
    expect(open.textContent).toContain('mobileWeb.scan.openDesktop');
    open.click();

    expect(prefer).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/parts'], { queryParams: { id: 3 } });
  });

  it('shows the camera permission help from translations', async () => {
    const fixture = TestBed.createComponent(MobileScanComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const rendered = fixture.componentInstance as unknown as {
      cameraUnavailable: { set(v: boolean): void };
      cameraError: { set(v: 'permission'): void };
    };

    rendered.cameraUnavailable.set(true);
    rendered.cameraError.set('permission');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('mobileLegacyPages.scan.permissionTitle');
    expect(text).toContain('mobileLegacyPages.scan.tryAgain');
    expect(text).not.toContain('Camera Permission Required');
  });
});
