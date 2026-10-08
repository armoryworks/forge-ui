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
