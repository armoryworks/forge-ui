import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RedirectCommand, Router, RouterStateSnapshot } from '@angular/router';
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

  type Decision = boolean | RedirectCommand;

  const run = (): Decision | Observable<Decision> =>
    TestBed.runInInjectionContext(() =>
      capabilityGuard('CAP-A', 'CAP-B')({} as ActivatedRouteSnapshot, { url: '/accounting/ledger' } as RouterStateSnapshot)) as
      Decision | Observable<Decision>;

  const expectFeatureOff = (result: unknown): void => {
    expect(result).toBeInstanceOf(RedirectCommand);
    const command = result as RedirectCommand;
    expect(TestBed.inject(Router).serializeUrl(command.redirectTo)).toBe('/feature-off');
    expect(command.navigationBehaviorOptions?.browserUrl).toBe('/accounting/ledger');
  };

  it('decides from the live descriptor without reloading it', () => {
    descriptor.mockReturnValue({});
    isEnabled.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('shows the feature-off page under the requested URL when any capability is off', () => {
    descriptor.mockReturnValue({});
    isEnabled.mockImplementation((code) => code === 'CAP-A');
    expectFeatureOff(run());
  });

  it('waits for the descriptor on a cold deep link before deciding', () => {
    descriptor.mockReturnValue(null);
    isEnabled.mockReturnValue(false);
    const result = run();
    expect(isObservable(result)).toBe(true);

    let decision: Decision | undefined;
    (result as Observable<Decision>).subscribe((d) => (decision = d));
    expect(decision).toBeUndefined();
    expect(isEnabled).not.toHaveBeenCalled();

    isEnabled.mockReturnValue(true);
    loaded.next();
    expect(decision).toBe(true);
  });

  it('still shows the feature-off page after the load when the capability is off', () => {
    descriptor.mockReturnValue(null);
    isEnabled.mockReturnValue(false);
    let decision: Decision | undefined;
    (run() as Observable<Decision>).subscribe((d) => (decision = d));
    loaded.next();
    expectFeatureOff(decision);
  });
});
