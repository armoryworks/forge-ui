import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Subject } from 'rxjs';

import { ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { ScannerService } from '../../../shared/services/scanner.service';
import { MobileScanComponent } from './mobile-scan.component';

interface ScanInternals {
  manualValue: { set(v: string): void };
  lastResult: () => ScanResolveResult | null;
  lookupError: () => string | null;
  resolving: () => boolean;
  submitManual(): void;
}

describe('MobileScanComponent', () => {
  const navigate = vi.fn();
  const resolveScan = vi.fn();
  let response: Subject<ScanResolveResult>;
  let component: ScanInternals;

  beforeEach(() => {
    vi.clearAllMocks();
    response = new Subject<ScanResolveResult>();
    resolveScan.mockReturnValue(response);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: MobileApiService, useValue: { resolveScan } },
        { provide: ScannerService, useValue: { setContext: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new MobileScanComponent()) as unknown as ScanInternals;
  });

  const submit = (value: string): void => {
    component.manualValue.set(value);
    component.submitManual();
  };

  it('asks the server to resolve the trimmed code', () => {
    submit('  job-1042 ');
    expect(resolveScan).toHaveBeenCalledWith('job-1042');
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

  it('reports a failed lookup', () => {
    submit('JOB-1');
    response.error(new Error('offline'));

    expect(component.lookupError()).not.toBeNull();
    expect(component.resolving()).toBe(false);
  });
});
