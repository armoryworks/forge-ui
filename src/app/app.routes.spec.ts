import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, Route, Router, RouterStateSnapshot } from '@angular/router';

import { routes } from './app.routes';
import { EXPENSES_ROUTES } from './features/expenses/expenses.routes';
import { ROUTE_ACCESS } from './shared/models/route-access.model';
import { RouteStatusPageComponent } from './shared/components/route-status-page/route-status-page.component';
import { authGuard } from './shared/guards/auth.guard';
import { AuthService } from './shared/services/auth.service';

@Component({ selector: 'app-test-kanban', standalone: true, template: '' })
class TestKanbanComponent {}

describe('app routes', () => {
  function boardRedirect(): Route {
    const shell = routes.find(r => r.path === '' && r.children?.some(c => c.path === 'kanban'));
    const redirect = shell?.children?.find(c => c.path === 'board');
    if (!redirect) throw new Error('board redirect missing');
    return redirect;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          boardRedirect(),
          { path: 'kanban', component: TestKanbanComponent },
        ]),
      ],
    });
  });

  it('redirects /board to /kanban and keeps the detail query', async () => {
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/board?detail=job:12');

    expect(router.url).toBe('/kanban?detail=job:12');
  });

  it('redirects a bare /board to /kanban', async () => {
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/board');

    expect(router.url).toBe('/kanban');
  });
});

describe('top-level setup routes', () => {
  it('declares setup/integrations before setup/:token so the token route does not swallow it', () => {
    const integrations = routes.findIndex(r => r.path === 'setup/integrations');
    const token = routes.findIndex(r => r.path === 'setup/:token');

    expect(integrations).toBeGreaterThanOrEqual(0);
    expect(token).toBeGreaterThan(integrations);
  });
});

describe('expenses route', () => {
  it('lets every employee reach their own expenses behind the expenses capability', () => {
    const expenses = routes.flatMap(r => r.children ?? []).find(r => r.path === 'expenses');

    expect(expenses?.canActivate?.length).toBe(1);
    expect(ROUTE_ACCESS['expenses']).toEqual({ capabilities: ['CAP-ACCT-EXPENSES'] });
  });

  it('keeps the approval queue with the reviewers and the recurring ledger with the office', () => {
    expect(ROUTE_ACCESS['expenses/approval'].roles).toEqual(['Admin', 'Manager', 'OfficeManager']);
    expect(ROUTE_ACCESS['expenses/upcoming'].roles).toEqual(['Admin', 'Manager', 'Engineer', 'OfficeManager']);
    for (const path of ['approval', 'upcoming']) {
      expect(EXPENSES_ROUTES.find(r => r.path === path)?.canActivate?.length, path).toBe(2);
    }
  });
});

describe('purchasing and payables routes', () => {
  function admits(path: string, roles: string[]): boolean {
    const route = routes.flatMap(r => r.children ?? []).find(r => r.path === path);
    const guard = route?.canActivate?.[0] as CanActivateFn | undefined;
    if (!guard) throw new Error(`${path} has no role guard`);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) === true;
  }

  it.each(['vendors', 'purchasing', 'purchase-orders', 'payables'])('admits Procurement to /%s', (path) => {
    expect(admits(path, ['Procurement'])).toBe(true);
  });

  it('admits the Controller to payables review but not to purchasing', () => {
    expect(admits('payables', ['Controller'])).toBe(true);
    expect(admits('vendors', ['Controller'])).toBe(false);
    expect(admits('purchase-orders', ['Controller'])).toBe(false);
  });

  it('keeps production workers out of purchasing and payables', () => {
    for (const path of ['vendors', 'purchasing', 'purchase-orders', 'payables']) {
      expect(admits(path, ['ProductionWorker'])).toBe(false);
    }
  });

  it('admits engineers to /assets, matching the assets API', () => {
    expect(admits('assets', ['Engineer'])).toBe(true);
    expect(admits('assets', ['OfficeManager'])).toBe(false);
  });

  it('admits the roles that may run planning cycles to /planning', () => {
    expect(admits('planning', ['PM'])).toBe(true);
    expect(admits('planning', ['Engineer'])).toBe(false);
  });
});

describe('route status pages', () => {
  it('shows a not-found page for an unknown URL to a signed-in user', async () => {
    const wildcard = routes[routes.length - 1];
    expect(wildcard.path).toBe('**');
    expect(wildcard.redirectTo).toBeUndefined();
    expect(wildcard.canActivate).toEqual([authGuard]);
    expect(wildcard.data).toEqual({ status: 'notFound' });
    const component = await (wildcard.loadComponent as () => Promise<unknown>)();
    expect(component).toBe(RouteStatusPageComponent);
  });

  it('registers the forbidden and feature-off pages inside the signed-in shell', () => {
    const shell = routes.find(r => r.path === '' && r.children?.some(c => c.path === 'kanban'));
    expect(shell?.children?.find(r => r.path === 'forbidden')?.data).toEqual({ status: 'forbidden' });
    expect(shell?.children?.find(r => r.path === 'feature-off')?.data).toEqual({ status: 'featureOff' });
  });

  it('keeps the headless form renderer reachable without a session', () => {
    const render = routes.find(r => r.path === '__render-form');
    expect(render).toBeDefined();
    expect(render?.canActivate).toBeUndefined();
  });
});

describe('developer pages', () => {
  it('are registered only through devOnlyRoutes, so a development build still has them', () => {
    const paths = [...routes.map(r => r.path), ...routes.flatMap(r => r.children ?? []).map(r => r.path)];
    expect(paths).toContain('dev-tools');
    expect(paths).toContain('workflow-shell-demo');
  });
});
