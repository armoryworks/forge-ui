import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TranslateService } from '@ngx-translate/core';

const UNDO_WINDOW_MS = 30_000;

/**
 * Every action shows an undo toast for thirty seconds; tapping Undo runs
 * the compensating action. The only confirmation in the shell is the prompt
 * before a timer switches from one job to another.
 */
@Injectable({ providedIn: 'root' })
export class UndoService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  offer(message: string, compensate: () => Promise<unknown>, closed?: () => void): void {
    const ref = this.snackBar.open(message, this.translate.instant('mobileApp.undo.action'), {
      duration: UNDO_WINDOW_MS,
      panelClass: ['snackbar--info', 'snackbar--undo'],
    });
    ref.onAction().subscribe(() => {
      compensate().catch(() => {
        this.snackBar.open(this.translate.instant('mobileApp.undo.failed'), undefined, {
          duration: 8000,
          panelClass: ['snackbar--error'],
        });
      });
    });
    if (closed) ref.afterDismissed().subscribe(() => closed());
  }
}
