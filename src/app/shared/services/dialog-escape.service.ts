import { DOCUMENT, Injectable, inject } from '@angular/core';

import { hasModifierKey } from '@angular/cdk/keycodes';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { filter, takeUntil } from 'rxjs';

import { DetailDialogService } from './detail-dialog.service';

const FIELD_OVERLAY_PANELS = '.mat-mdc-select-panel, .mat-mdc-autocomplete-panel.mat-mdc-autocomplete-visible, .mat-datepicker-content';
const DISMISS_METHODS = ['cancel', 'close'] as const;

/** An open `<app-dialog>`, closable through its own unsaved-changes guard. `hostRef` is null for one rendered inline in a page. */
export interface DialogEscapeTarget {
  readonly hostRef: MatDialogRef<unknown, unknown> | null;
  tryClose(): void;
}

/**
 * Escape closes the topmost MatDialog, since the app-wide `disableClose` default
 * turns off the CDK's own Escape handling.
 *
 * The overlay keyboard dispatcher routes the key to the topmost overlay, so an
 * open select, datepicker or tooltip takes it first. When the dialog hosts
 * `<app-dialog>`s, the most recently registered one closes through `tryClose()`
 * (and so asks about unsaved changes). Otherwise the dialog component's own
 * `cancel()` or `close()` runs, falling back to closing the ref with no result.
 * Detail dialogs without an `<app-dialog>` are left to {@link DetailDialogService}.
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
        filter(event => event.key === 'Escape' && !event.defaultPrevented && !hasModifierKey(event)),
        takeUntil(ref.afterClosed()),
      )
      .subscribe(() => this.onEscape(ref));
  }

  private onEscape(ref: MatDialogRef<unknown, unknown>): void {
    if (this.escapeOwnedByFieldOverlay) return;
    const target = this.topmost(ref);
    if (target) {
      target.tryClose();
      return;
    }
    if (this.detailDialog.isCurrent(ref)) return;
    const instance = ref.componentInstance as Record<string, unknown> | null;
    const method = DISMISS_METHODS
      .map(name => instance?.[name])
      .find((fn): fn is () => void => typeof fn === 'function' && fn.length === 0);
    if (method) {
      method.call(instance);
    } else {
      ref.close();
    }
  }
}
