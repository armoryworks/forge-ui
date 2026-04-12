import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationStart, Router } from '@angular/router';

import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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
    this.snackBar.open(message, 'Dismiss', {
      duration: 4000,
      panelClass: ['snackbar--success'],
    });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 4000,
      panelClass: ['snackbar--info'],
    });
  }

  warn(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 8000,
      panelClass: ['snackbar--warn'],
    });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 10000,
      panelClass: ['snackbar--error'],
    });
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
}
