import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, Subject, isObservable } from 'rxjs';

import { CapabilityService } from '../services/capability.service';
import { capabilityGuard } from './capability.guard';

describe('capabilityGuard', () => {
  const isEnabled = vi.fn<(code: string) => boolean>();
  const descriptor = vi.fn<() => object | null>();
  let loaded: Subject<void>;
  const load = vi.fn(() => loaded.asObservable());

  beforeEach(() => {
    isEnabled.mockReset();
    descriptor.mockReset();
    load.mockClear();
    loaded = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [{ provide: CapabilityService, useValue: { isEnabled, descriptor, load } }],
    });
  });

  const run = (): boolean | UrlTree | Observable<boolean | UrlTree> =>
    TestBed.runInInjectionContext(() =>
      capabilityGuard('CAP-A', 'CAP-B')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as
      boolean | UrlTree | Observable<boolean | UrlTree>;

  const urlOf = (result: unknown): string => {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  };

  it('decides from the live descriptor without reloading it', () => {
    descriptor.mockReturnValue({});
    isEnabled.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('redirects to the dashboard when any capability is off', () => {
    descriptor.mockReturnValue({});
    isEnabled.mockImplementation((code) => code === 'CAP-A');
    expect(urlOf(run())).toBe('/dashboard');
  });

  it('waits for the descriptor on a cold deep link before deciding', () => {
    descriptor.mockReturnValue(null);
    isEnabled.mockReturnValue(false);
    const result = run();
    expect(isObservable(result)).toBe(true);

    let decision: boolean | UrlTree | undefined;
    (result as Observable<boolean | UrlTree>).subscribe((d) => (decision = d));
    expect(decision).toBeUndefined();
    expect(isEnabled).not.toHaveBeenCalled();

    isEnabled.mockReturnValue(true);
    loaded.next();
    expect(decision).toBe(true);
  });

  it('still redirects after the load when the capability is off', () => {
    descriptor.mockReturnValue(null);
    isEnabled.mockReturnValue(false);
    let decision: boolean | UrlTree | undefined;
    (run() as Observable<boolean | UrlTree>).subscribe((d) => (decision = d));
    loaded.next();
    expect(urlOf(decision)).toBe('/dashboard');
  });
});
