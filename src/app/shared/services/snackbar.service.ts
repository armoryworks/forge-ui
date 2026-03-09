import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

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
      panelClass: ['snackbar--warn'],
    });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
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
