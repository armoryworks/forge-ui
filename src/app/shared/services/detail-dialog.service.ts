import { DOCUMENT, Injectable, inject } from '@angular/core';

import { ComponentType } from '@angular/cdk/overlay';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { filter } from 'rxjs';

const FIELD_OVERLAY_PANELS = '.mat-mdc-select-panel, .mat-mdc-autocomplete-panel.mat-mdc-autocomplete-visible, .mat-datepicker-content';

/**
 * Centralized detail dialog opener with URL sync.
 *
 * Sets `?detail=entityType:entityId` on open; on close clears it and any `?tab=` the panel added.
 * Only one detail dialog is open at a time: opening another replaces the current one.
 * Feature components call `getDetailFromUrl()` in init to auto-open
 * when the page loads with a detail param (shared links, bookmarks, refresh).
 * Escape closes the topmost detail dialog through its component's own `close()`,
 * unless an open field overlay or an inline `<app-dialog>` inside it owns the key.
 */
@Injectable({ providedIn: 'root' })
export class DetailDialogService {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private current: MatDialogRef<unknown, unknown> | null = null;
  private focusOrigin: HTMLElement | null = null;
  private pageTab: string | null = null;
  private escapeOwnedByFieldOverlay = false;

  constructor() {
    this.document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.escapeOwnedByFieldOverlay = this.document.querySelector(FIELD_OVERLAY_PANELS) !== null;
      }
    }, true);
  }

  /**
   * Open a detail dialog and sync the URL. Closes any detail dialog that is
   * already open, moves focus into the new dialog at once and returns it to
   * the element that opened the first dialog in the chain on close.
   *
   * @returns MatDialogRef — callers can chain `.afterClosed()` for feature-specific logic.
   *
   * `config.width` defaults to 1400px (full-detail wrapper case used by Parts,
   * Vendors, Leads, etc.). Lightweight preview dialogs (CustomerDetailDialog
   * shows just the overview) override to a narrower width — pass e.g. `'720px'`.
   */
  open<T, D, R = undefined>(
    entityType: string,
    entityId: number,
    component: ComponentType<T>,
    data: D,
    config?: { width?: string },
  ): MatDialogRef<T, R> {
    const previous = this.current;
    this.current = null;
    if (previous) {
      previous.close();
    } else {
      this.focusOrigin = this.activeElement();
      this.pageTab = this.router.parseUrl(this.router.url).queryParams['tab'] ?? null;
    }

    this.setDetailParam(entityType, entityId);

    const ref = this.dialog.open<T, D, R>(component, {
      width: config?.width ?? '1400px',
      maxWidth: '95vw',
      panelClass: 'detail-dialog-panel',
      data,
      enterAnimationDuration: '150ms',
      autoFocus: 'dialog',
      delayFocusTrap: false,
      restoreFocus: this.focusOrigin ?? true,
    });

    this.current = ref as MatDialogRef<unknown, unknown>;
    ref.keydownEvents()
      .pipe(filter(event => event.key === 'Escape' && !event.defaultPrevented))
      .subscribe(() => this.closeOnEscape(ref as MatDialogRef<unknown, unknown>));
    ref.afterClosed().subscribe(() => {
      if (this.current !== (ref as MatDialogRef<unknown, unknown>)) return;
      this.current = null;
      this.focusOrigin = null;
      this.clearDetailParam(this.pageTab);
      this.pageTab = null;
    });

    return ref;
  }

  /** True when `ref` is the detail dialog this service currently has open. */
  isCurrent(ref: MatDialogRef<unknown, unknown> | null): boolean {
    return ref !== null && ref === this.current;
  }

  /**
   * Parse `?detail=type:id` from the current URL.
   * Returns null if no detail param or invalid format.
   */
  getDetailFromUrl(): { entityType: string; entityId: number } | null {
    const urlTree = this.router.parseUrl(this.router.url);
    const detail = urlTree.queryParams['detail'];
    if (!detail) return null;
    const colonIdx = detail.indexOf(':');
    if (colonIdx < 0) return null;
    const type = detail.substring(0, colonIdx);
    const id = parseInt(detail.substring(colonIdx + 1), 10);
    if (!type || isNaN(id)) return null;
    return { entityType: type, entityId: id };
  }

  private closeOnEscape(ref: MatDialogRef<unknown, unknown>): void {
    if (this.escapeOwnedByFieldOverlay) return;
    if (this.document.getElementById(ref.id)?.querySelector('app-dialog')) return;
    const instance = ref.componentInstance as { close?: unknown } | null;
    if (typeof instance?.close === 'function') {
      (instance.close as () => void).call(instance);
    } else {
      ref.close();
    }
  }

  private activeElement(): HTMLElement | null {
    const active = this.document.activeElement;
    return active instanceof HTMLElement && active !== this.document.body ? active : null;
  }

  private setDetailParam(entityType: string, entityId: number): void {
    const urlTree = this.router.parseUrl(this.router.url);
    urlTree.queryParams['detail'] = `${entityType}:${entityId}`;
    this.router.navigateByUrl(urlTree, { replaceUrl: true });
  }

  private clearDetailParam(pageTab: string | null): void {
    const urlTree = this.router.parseUrl(this.router.url);
    const params = urlTree.queryParams;
    if (!params['detail'] && (params['tab'] ?? null) === pageTab) return;
    delete params['detail'];
    if (pageTab === null) {
      delete params['tab'];
    } else {
      params['tab'] = pageTab;
    }
    this.router.navigateByUrl(urlTree, { replaceUrl: true });
  }
}
