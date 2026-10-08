import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationStart, Router } from '@angular/router';

import { TranslateService } from '@ngx-translate/core';
import { Observable, filter } from 'rxjs';

import { wasHttpErrorShown } from '../utils/shown-http-errors';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly toasts = inject(ToastService);

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
    this.toasts.clearErrors();
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
      ?? meaningfulTitle(body)
      ?? this.translate.instant(fallbackKey),
    );
  }

  successWithNav(message: string, route: string, actionLabel: string): void {
    this.toasts.clearErrors();
    const ref = this.snackBar.open(message, actionLabel, {
      duration: 4000,
      panelClass: ['snackbar--success'],
    });

    ref.onAction().subscribe(() => {
      this.router.navigate([route]);
    });
  }

  successWithAction(message: string, actionLabel: string): Observable<void> {
    return this.snackBar.open(message, actionLabel, {
      duration: 8000,
      panelClass: ['snackbar--success'],
    }).onAction();
  }

  private dismissLabel(): string {
    return this.translate.instant('common.dismiss');
  }
}

const HTTP_REASON_PHRASES: ReadonlySet<string> = new Set([
  'bad request', 'unauthorized', 'payment required', 'forbidden', 'not found',
  'method not allowed', 'not acceptable', 'proxy authentication required', 'request timeout',
  'conflict', 'gone', 'length required', 'precondition failed', 'payload too large',
  'content too large', 'uri too long', 'unsupported media type', 'range not satisfiable',
  'expectation failed', 'misdirected request', 'unprocessable entity', 'unprocessable content',
  'locked', 'failed dependency', 'too early', 'upgrade required', 'precondition required',
  'too many requests', 'request header fields too large', 'unavailable for legal reasons',
  'internal server error', 'not implemented', 'bad gateway', 'service unavailable',
  'gateway timeout', 'http version not supported', 'insufficient storage', 'loop detected',
  'network authentication required',
  'an error occurred while processing your request.',
]);

function meaningfulTitle(body: unknown): string | null {
  const title = problemText(body, 'title');
  if (title === null) return null;
  const hasErrors = (body as Record<string, unknown>)['errors'] != null;
  return hasErrors || !HTTP_REASON_PHRASES.has(title.trim().toLowerCase()) ? title : null;
}

function problemText(body: unknown, key: 'detail' | 'title'): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}
