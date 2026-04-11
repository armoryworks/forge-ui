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

    // May have a minimum display delay — advance timers to cover it
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
});
