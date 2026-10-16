import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router } from '@angular/router';

import { routes } from './app.routes';

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
