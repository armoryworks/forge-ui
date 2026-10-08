import { DOCUMENT, Injectable, inject } from '@angular/core';

import { ComponentType } from '@angular/cdk/overlay';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

/**
 * Centralized detail dialog opener with URL sync.
 *
 * Sets `?detail=entityType:entityId` on open; on close clears it and any `?tab=` the panel added.
 * Only one detail dialog is open at a time: opening another replaces the current one.
 * Feature components call `getDetailFromUrl()` in init to auto-open
 * when the page loads with a detail param (shared links, bookmarks, refresh).
 */
@Injectable({ providedIn: 'root' })
export class DetailDialogService {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private current: MatDialogRef<unknown, unknown> | null = null;
  private focusOrigin: HTMLElement | null = null;
  private pageTab: string | null = null;

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
    ref.afterClosed().subscribe(() => {
      if (this.current !== (ref as MatDialogRef<unknown, unknown>)) return;
      this.current = null;
      this.focusOrigin = null;
      this.clearDetailParam(this.pageTab);
      this.pageTab = null;
    });

    return ref;
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
