import { Injectable, inject } from '@angular/core';

import { ComponentType } from '@angular/cdk/overlay';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

/**
 * Centralized detail dialog opener with URL sync.
 *
 * Sets `?detail=entityType:entityId` on open, clears on close.
 * Feature components call `getDetailFromUrl()` in init to auto-open
 * when the page loads with a detail param (shared links, bookmarks, refresh).
 */
@Injectable({ providedIn: 'root' })
export class DetailDialogService {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /**
   * Open a detail dialog and sync the URL.
   *
   * @returns MatDialogRef — callers can chain `.afterClosed()` for feature-specific logic.
   */
  open<T, D, R = undefined>(
    entityType: string,
    entityId: number,
    component: ComponentType<T>,
    data: D,
  ): MatDialogRef<T, R> {
    this.setDetailParam(entityType, entityId);

    const ref = this.dialog.open<T, D, R>(component, {
      width: '1400px',
      maxWidth: '95vw',
      panelClass: 'detail-dialog-panel',
      data,
    });

    ref.afterClosed().subscribe(() => this.clearDetailParam());

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

  private setDetailParam(entityType: string, entityId: number): void {
    const urlTree = this.router.parseUrl(this.router.url);
    urlTree.queryParams['detail'] = `${entityType}:${entityId}`;
    this.router.navigateByUrl(urlTree, { replaceUrl: true });
  }

  private clearDetailParam(): void {
    const urlTree = this.router.parseUrl(this.router.url);
    if (urlTree.queryParams['detail']) {
      delete urlTree.queryParams['detail'];
      this.router.navigateByUrl(urlTree, { replaceUrl: true });
    }
  }
}
