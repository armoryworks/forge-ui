import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot, convertToParamMap, NavigationCancel, NavigationCancellationCode, NavigationEnd, RedirectCommand, Router, RouterStateSnapshot,
} from '@angular/router';
import { Subject } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../services/auth.service';
import { SnackbarService } from '../services/snackbar.service';
import { tabGuard } from './tab.guard';

describe('tabGuard', () => {
  const hasAnyRole = vi.fn<(roles: string[]) => boolean>();
  const info = vi.fn();
  let events: Subject<unknown>;

  beforeEach(() => {
    hasAnyRole.mockReset();
    info.mockReset();
    events = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { hasAnyRole } },
        { provide: SnackbarService, useValue: { info } },
        { provide: TranslateService, useValue: { instant: (key: string, params: { tab: string }) => `${key}:${params.tab}` } },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'events', 'get').mockReturnValue(events as unknown as Router['events']);
  });

  const run = (tab: string, url: string, guard = tabGuard(['orders', 'settings'], 'orders', { settings: ['Admin'] })): unknown =>
    TestBed.runInInjectionContext(() =>
      guard({ paramMap: convertToParamMap({ tab }) } as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  const serialize = (command: RedirectCommand): string => TestBed.inject(Router).serializeUrl(command.redirectTo);

  it('lets a known, ungated tab through', () => {
    expect(run('orders', '/purchase-orders/orders')).toBe(true);
  });

  it('lets a gated tab through for a role that may open it', () => {
    hasAnyRole.mockReturnValue(true);
    expect(run('settings', '/purchase-orders/settings')).toBe(true);
    expect(hasAnyRole).toHaveBeenCalledWith(['Admin']);
  });

  it('shows the forbidden page for a gated tab the role may not open', () => {
    hasAnyRole.mockReturnValue(false);
    const result = run('settings', '/purchase-orders/settings') as RedirectCommand;
    expect(result).toBeInstanceOf(RedirectCommand);
    expect(serialize(result)).toBe('/forbidden');
    expect(result.navigationBehaviorOptions?.browserUrl).toBe('/purchase-orders/settings');
  });

  it('replaces an unknown tab with the default, keeping the rest of the URL, and says so once shown', () => {
    const result = run('bogus', '/employees/12/bogus?kind=user') as RedirectCommand;
    expect(result).toBeInstanceOf(RedirectCommand);
    expect(serialize(result)).toBe('/employees/12/orders?kind=user');
    expect(result.navigationBehaviorOptions?.replaceUrl).toBe(true);
    expect(info).not.toHaveBeenCalled();
    events.next(new NavigationCancel(1, '/employees/12/bogus', '', NavigationCancellationCode.Redirect));
    expect(info).not.toHaveBeenCalled();
    events.next(new NavigationEnd(2, '/employees/12/orders', '/employees/12/orders'));
    expect(info).toHaveBeenCalledWith('routeStatus.unknownTab:bogus');
  });

  it('resolves a default that depends on the user', () => {
    const guard = tabGuard(['overview', 'compliance'], () => 'compliance');
    expect(serialize(run('nope', '/admin/nope', guard) as RedirectCommand)).toBe('/admin/compliance');
  });
});
