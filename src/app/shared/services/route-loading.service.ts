import { Injectable, inject, DestroyRef } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { LoadingService } from './loading.service';

const ROUTE_LOADING_KEY = 'route-navigation';
const MIN_DISPLAY_MS = 400;

@Injectable({ providedIn: 'root' })
export class RouteLoadingService {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);
  private navigationStartTime = 0;

  initialize(): void {
    this.router.events.pipe(
      filter(e =>
        e instanceof NavigationStart ||
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.navigationStartTime = Date.now();
        this.loading.start(ROUTE_LOADING_KEY, 'Loading...');
      } else {
        const elapsed = Date.now() - this.navigationStartTime;
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

        if (remaining > 0) {
          setTimeout(() => this.loading.stop(ROUTE_LOADING_KEY), remaining);
        } else {
          this.loading.stop(ROUTE_LOADING_KEY);
        }
      }
    });
  }
}
