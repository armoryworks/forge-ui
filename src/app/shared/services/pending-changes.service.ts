import { Injectable, computed, inject, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Observable, map, of, tap } from 'rxjs';

import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';

/**
 * Unsaved edits held by a component embedded in a page (an editor inside a tab or a detail dialog) that the page's
 * own form does not know about. The holder marks itself dirty; whatever would throw the edits away (leaving the
 * route, switching tabs, closing the dialog) asks {@link confirmDiscard} first.
 */
@Injectable({ providedIn: 'root' })
export class PendingChangesService {
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  private readonly holders = signal<ReadonlySet<object>>(new Set());

  /** True while any holder has unsaved edits. */
  readonly hasPending = computed(() => this.holders().size > 0);

  /** Marks `holder` as holding unsaved edits, or clears it. */
  set(holder: object, dirty: boolean): void {
    if (this.holders().has(holder) === dirty) return;
    this.holders.update(current => {
      const next = new Set(current);
      if (dirty) next.add(holder);
      else next.delete(holder);
      return next;
    });
  }

  /**
   * Emits true straight away when nothing is unsaved; otherwise asks whether to discard the edits and emits the
   * answer. Discarding clears every holder.
   */
  confirmDiscard(): Observable<boolean> {
    if (!this.hasPending()) return of(true);
    return this.dialog
      .open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: this.translate.instant('dialog.unsaved.title'),
          message: this.translate.instant('dialog.unsaved.leaveMessage'),
          confirmLabel: this.translate.instant('dialog.unsaved.leave'),
          cancelLabel: this.translate.instant('dialog.unsaved.stay'),
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(
        map(confirmed => confirmed === true),
        tap(discard => {
          if (discard) this.holders.set(new Set());
        }),
      );
  }
}
