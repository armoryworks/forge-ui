import { TestBed } from '@angular/core/testing';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Subject } from 'rxjs';

import { RouteLoadingService } from './route-loading.service';
import { LoadingService } from './loading.service';

describe('RouteLoadingService', () => {
  let service: RouteLoadingService;
  let loadingService: LoadingService;
  let routerEvents$: Subject<unknown>;

  beforeEach(() => {
    routerEvents$ = new Subject();

    TestBed.configureTestingModule({
      providers: [
        RouteLoadingService,
        LoadingService,
        {
          provide: Router,
          useValue: { events: routerEvents$.asObservable() },
        },
      ],
    });

    service = TestBed.inject(RouteLoadingService);
    loadingService = TestBed.inject(LoadingService);
  });

  // ── initialize ──

  it('initialize should set up router event listeners', () => {
    service.initialize();

    // Should not be loading before any events
    expect(loadingService.isLoading()).toBe(false);

    // Emit a NavigationStart — should start loading
    routerEvents$.next(new NavigationStart(1, '/dashboard'));
    expect(loadingService.isLoading()).toBe(true);
  });

  it('should show loading on NavigationStart', () => {
    service.initialize();

    routerEvents$.next(new NavigationStart(1, '/kanban'));

    expect(loadingService.isLoading()).toBe(true);
    expect(loadingService.message()).toBe('Loading...');
  });

  it('should hide loading on NavigationEnd', () => {
    vi.useFakeTimers();
    service.initialize();

    routerEvents$.next(new NavigationStart(1, '/kanban'));
    expect(loadingService.isLoading()).toBe(true);

    routerEvents$.next(new NavigationEnd(1, '/kanban', '/kanban'));

    vi.advanceTimersByTime(500);

    expect(loadingService.isLoading()).toBe(false);
    vi.useRealTimers();
  });

  it('should hide loading on NavigationCancel', () => {
    vi.useFakeTimers();
    service.initialize();

    routerEvents$.next(new NavigationStart(1, '/kanban'));
    routerEvents$.next(new NavigationCancel(1, '/kanban', ''));

    vi.advanceTimersByTime(500);

    expect(loadingService.isLoading()).toBe(false);
    vi.useRealTimers();
  });

  it('should hide loading on NavigationError', () => {
    vi.useFakeTimers();
    service.initialize();

    routerEvents$.next(new NavigationStart(1, '/kanban'));
    routerEvents$.next(new NavigationError(1, '/kanban', new Error('fail')));

    vi.advanceTimersByTime(500);

    expect(loadingService.isLoading()).toBe(false);
    vi.useRealTimers();
  });

  it('blocks interaction while the route has no content', () => {
    service.initialize();

    routerEvents$.next(new NavigationStart(1, '/kanban'));

    expect(loadingService.blocking()).toBe(true);
  });

  it('stops the moment navigation ends, with no minimum display', () => {
    service.initialize();

    routerEvents$.next(new NavigationStart(1, '/kanban'));
    routerEvents$.next(new NavigationEnd(1, '/kanban', '/kanban'));

    expect(loadingService.isLoading()).toBe(false);
    expect(loadingService.blocking()).toBe(false);
  });

  it('ignores navigations that only change the query, such as opening a detail dialog', () => {
    service.initialize();
    routerEvents$.next(new NavigationStart(1, '/parts'));
    routerEvents$.next(new NavigationEnd(1, '/parts', '/parts'));

    routerEvents$.next(new NavigationStart(2, '/parts?detail=part:7'));

    expect(loadingService.isLoading()).toBe(false);
  });

  it('measures the path after redirects', () => {
    service.initialize();
    routerEvents$.next(new NavigationStart(1, '/board?detail=job:3'));
    routerEvents$.next(new NavigationEnd(1, '/board?detail=job:3', '/kanban?detail=job:3'));

    routerEvents$.next(new NavigationStart(2, '/kanban'));

    expect(loadingService.isLoading()).toBe(false);
  });
});
