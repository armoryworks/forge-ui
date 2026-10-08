import { Injectable, inject, DestroyRef } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { LoadingService } from './loading.service';

const ROUTE_LOADING_KEY = 'route-navigation';

@Injectable({ providedIn: 'root' })
export class RouteLoadingService {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);
  private currentPath: string | null = null;

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
        if (pathOf(event.url) === this.currentPath) return;
        this.loading.start(ROUTE_LOADING_KEY, 'Loading...', { blocking: true });
        return;
      }
      if (event instanceof NavigationEnd) {
        this.currentPath = pathOf(event.urlAfterRedirects);
      }
      this.loading.stop(ROUTE_LOADING_KEY);
    });
  }
}

function pathOf(url: string): string {
  return url.split(/[?#]/, 1)[0];
}
