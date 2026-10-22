import { DOCUMENT, Injectable, inject } from '@angular/core';

import { hasModifierKey } from '@angular/cdk/keycodes';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, filter, map, takeUntil } from 'rxjs';

import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import { DialogEscapeHandler, DialogEscapeOptions } from '../models/dialog-escape.model';
import { DetailDialogService } from './detail-dialog.service';

const FIELD_OVERLAY_PANELS = '.mat-mdc-select-panel, .mat-mdc-autocomplete-panel.mat-mdc-autocomplete-visible, .mat-datepicker-content';

/** An open `<app-dialog>`, closable through its own unsaved-changes guard. `hostRef` is null for one rendered inline in a page. */
export interface DialogEscapeTarget {
  readonly hostRef: MatDialogRef<unknown, unknown> | null;
  tryClose(): void;
}

/** True when `instance` implements {@link DialogEscapeHandler}. */
export function isDialogEscapeHandler(instance: unknown): instance is DialogEscapeHandler {
  return typeof instance === 'object' && instance !== null
    && typeof (instance as Partial<DialogEscapeHandler>).onDialogEscape === 'function';
}

/**
 * Escape closes the topmost MatDialog, since the app-wide `disableClose` default
 * turns off the CDK's own Escape handling. A dialog opened with `disableClose: false`
 * keeps the CDK's handling and is left alone.
 *
 * The overlay keyboard dispatcher routes the key to the topmost overlay, so an
 * open select, datepicker or tooltip takes it first. When the dialog hosts
 * `<app-dialog>`s, the most recently registered one closes through `tryClose()`
 * (and so asks about unsaved changes). Otherwise a component implementing
 * {@link DialogEscapeHandler} handles it, and any other dialog closes with no result.
 * A dialog whose data sets `escapeCloses: false` stays open. Detail dialogs without
 * an `<app-dialog>` are left to {@link DetailDialogService}.
 */
@Injectable({ providedIn: 'root' })
export class DialogEscapeService {
  private readonly dialog = inject(MatDialog);
  private readonly document = inject(DOCUMENT);
  private readonly detailDialog = inject(DetailDialogService);

  private readonly targets: DialogEscapeTarget[] = [];
  private escapeOwnedByFieldOverlay = false;
  private started = false;

  /** Starts watching every MatDialog the app opens. Called once at bootstrap. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.escapeOwnedByFieldOverlay = this.document.querySelector(FIELD_OVERLAY_PANELS) !== null;
      }
    }, true);
    this.dialog.afterOpened.subscribe(ref => this.watch(ref as MatDialogRef<unknown, unknown>));
  }

  /** Registers an open `<app-dialog>`. Returns the function that unregisters it. */
  register(target: DialogEscapeTarget): () => void {
    this.targets.push(target);
    return () => {
      const index = this.targets.indexOf(target);
      if (index >= 0) this.targets.splice(index, 1);
    };
  }

  /** Asks whether to discard unsaved changes and close. Emits true when the user chooses to close. */
  confirmDiscard(): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: 'Unsaved Changes',
          message: 'You have unsaved changes that will be lost. Are you sure you want to close?',
          confirmLabel: 'Close',
          cancelLabel: 'Stay',
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(map(confirmed => confirmed === true));
  }

  /** Escape handling for a dialog form: closes through `close` straight away when `dirty` is false, otherwise after the user confirms the discard. */
  closeUnlessDirty(dirty: boolean, close: () => void): void {
    if (!dirty) {
      close();
      return;
    }
    this.confirmDiscard().subscribe(discard => {
      if (discard) close();
    });
  }

  /** True when no `<app-dialog>` registered later shares `target`'s host, so `target` is the one Escape should close. */
  isTopmost(target: DialogEscapeTarget): boolean {
    return this.topmost(target.hostRef) === target;
  }

  private topmost(hostRef: MatDialogRef<unknown, unknown> | null): DialogEscapeTarget | undefined {
    return this.targets.filter(t => t.hostRef === hostRef).at(-1);
  }

  private watch(ref: MatDialogRef<unknown, unknown>): void {
    ref.keydownEvents()
      .pipe(
        filter(event => event.key === 'Escape' && ref.disableClose === true && !event.defaultPrevented && !hasModifierKey(event)),
        takeUntil(ref.afterClosed()),
      )
      .subscribe(() => this.onEscape(ref));
  }

  private onEscape(ref: MatDialogRef<unknown, unknown>): void {
    if (this.escapeOwnedByFieldOverlay) return;
    if (!this.escapeCloses(ref)) return;
    const target = this.topmost(ref);
    if (target) {
      target.tryClose();
      return;
    }
    if (this.detailDialog.isCurrent(ref)) return;
    const instance: unknown = ref.componentInstance;
    if (isDialogEscapeHandler(instance)) {
      instance.onDialogEscape();
    } else {
      ref.close();
    }
  }

  private escapeCloses(ref: MatDialogRef<unknown, unknown>): boolean {
    const data: unknown = ref.componentRef?.injector.get(MAT_DIALOG_DATA, null);
    return typeof data !== 'object' || data === null || (data as DialogEscapeOptions).escapeCloses !== false;
  }
}
