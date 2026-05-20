import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { filter, interval } from 'rxjs';

/**
 * Surfaces freshly-deployed app versions so users actually pick up fixes.
 *
 * Without this, ngsw downloads a new build in the background but keeps serving
 * the cached one until every tab is closed — so a plain refresh (or even a
 * "hard" refresh) leaves the user on a stale app, making shipped fixes look
 * undone. We watch for VERSION_READY and offer a one-click reload, and poll so
 * an already-open tab notices a redeploy promptly.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Call once after auth init (AppComponent.ngOnInit). No-op when the SW is disabled (dev). */
  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.promptReload());

    void this.swUpdate.checkForUpdate();
    interval(60_000).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.swUpdate.checkForUpdate());
  }

  private promptReload(): void {
    // Sticky (no auto-dismiss) so the prompt waits for the user to reload at a
    // safe moment rather than yanking them mid-edit; in-progress form data is
    // already persisted to IndexedDB drafts.
    this.snackBar.open(
      this.translate.instant('app.updateAvailable'),
      this.translate.instant('app.reload'),
      { panelClass: ['snackbar--info'] },
    ).onAction().subscribe(() => {
      void this.swUpdate.activateUpdate().then(() => document.location.reload());
    });
  }
}
