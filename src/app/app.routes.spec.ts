import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, Route, Router, RouterStateSnapshot } from '@angular/router';

import { routes } from './app.routes';
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
  it('is role-guarded so production workers cannot reach it by URL', () => {
    const expenses = routes.flatMap(r => r.children ?? []).find(r => r.path === 'expenses');

    expect(expenses?.canActivate?.length).toBe(1);
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
