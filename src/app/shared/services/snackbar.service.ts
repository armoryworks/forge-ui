import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationStart, Router } from '@angular/router';

import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';

import { wasHttpErrorShown } from '../utils/shown-http-errors';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  constructor() {
    // Dismiss any open snackbar on route navigation
    this.router.events.pipe(
      filter(e => e instanceof NavigationStart),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.snackBar.dismiss();
    });
  }

  success(message: string): void {
    this.snackBar.open(message, this.dismissLabel(), {
      duration: 4000,
      panelClass: ['snackbar--success'],
    });
  }

  info(message: string): void {
    this.snackBar.open(message, this.dismissLabel(), {
      duration: 4000,
      panelClass: ['snackbar--info'],
    });
  }

  warn(message: string): void {
    this.snackBar.open(message, this.dismissLabel(), {
      duration: 8000,
      panelClass: ['snackbar--warn'],
    });
  }

  error(message: string): void {
    this.snackBar.open(message, this.dismissLabel(), {
      duration: 10000,
      panelClass: ['snackbar--error'],
    });
  }

  errorFrom(err: unknown, fallbackKey: string): void {
    if (wasHttpErrorShown(err)) return;
    const body: unknown = err instanceof HttpErrorResponse ? err.error : null;
    this.error(
      problemText(body, 'detail')
      ?? problemText(body, 'title')
      ?? this.translate.instant(fallbackKey),
    );
  }

  successWithNav(message: string, route: string, actionLabel: string): void {
    const ref = this.snackBar.open(message, actionLabel, {
      duration: 4000,
      panelClass: ['snackbar--success'],
    });

    ref.onAction().subscribe(() => {
      this.router.navigate([route]);
    });
  }

  private dismissLabel(): string {
    return this.translate.instant('common.dismiss');
  }
}

function problemText(body: unknown, key: 'detail' | 'title'): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}
