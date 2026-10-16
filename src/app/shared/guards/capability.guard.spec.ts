import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, Subject, firstValueFrom, isObservable } from 'rxjs';

import { CapabilityService } from '../services/capability.service';
import { capabilityGuard } from './capability.guard';

describe('capabilityGuard', () => {
  const isEnabled = vi.fn<(code: string) => boolean>();
  const descriptor = vi.fn<() => object | null>();
  const load = vi.fn<() => Observable<void>>();

  beforeEach(() => {
    isEnabled.mockReset();
    descriptor.mockReset();
    load.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: CapabilityService, useValue: { isEnabled, descriptor, load } }],
    });
  });

  const run = () =>
    TestBed.runInInjectionContext(() =>
      capabilityGuard('CAP-HR-PIECE-RATES')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  const urlOf = (result: unknown): string => {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  };

  it('answers at once from a loaded descriptor', () => {
    descriptor.mockReturnValue({});
    isEnabled.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('redirects to the dashboard when the capability is off', () => {
    descriptor.mockReturnValue({});
    isEnabled.mockReturnValue(false);
    expect(urlOf(run())).toBe('/dashboard');
  });

  it('waits for the descriptor before deciding on a deep link', async () => {
    descriptor.mockReturnValue(null);
    const loaded = new Subject<void>();
    load.mockReturnValue(loaded.asObservable());
    isEnabled.mockReturnValue(false);

    const result = run();
    expect(isObservable(result)).toBe(true);
    const decision = firstValueFrom(result as Observable<boolean | UrlTree>);
    isEnabled.mockReturnValue(true);
    loaded.next();
    loaded.complete();

    expect(await decision).toBe(true);
  });
});
