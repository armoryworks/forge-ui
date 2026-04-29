import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { firstValueFrom } from 'rxjs';

import { SnackbarService } from './snackbar.service';
import { WorkflowService } from './workflow.service';
import { WorkflowActiveListDialogComponent } from '../components/workflow-active-list/workflow-active-list-dialog.component';

/**
 * Workflow Pattern Phase 4 — Resume affordance orchestrator.
 *
 * Shows a soft-prompt snackbar after login when the user has at least one
 * in-flight workflow_run with `last_activity_at` within the recent window
 * (default 24h — tunable via the doc's resolved Q5: drafts coexist with
 * runs but use independent recovery flows).
 *
 * The snackbar carries a "Resume drafts" action that opens
 * {@link WorkflowActiveListDialogComponent}, where the user picks which
 * run to resume and is routed to its entity detail page with the
 * `?workflow=...` query param the shell mounts on.
 *
 * Wire-up: `AppComponent.ngOnInit()` calls `checkAfterLogin()` after
 * AuthService.isAuthenticated() flips true. The service is idempotent —
 * repeated calls within the same session are no-ops once the user has
 * dismissed the prompt or seen it once.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowResumeService {
  private readonly workflowService = inject(WorkflowService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  /**
   * Per-decision: 24-hour window. Phase 5 may make this user-tunable
   * alongside the existing draft TTL preference.
   */
  private static readonly RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

  private hasShownThisSession = false;

  /** Reset between logout and the next login (called by AuthService.logout). */
  reset(): void {
    this.hasShownThisSession = false;
  }

  /**
   * Fetch active runs and surface a soft-prompt snackbar if any are
   * within the recent window. Idempotent for a session.
   */
  async checkAfterLogin(): Promise<void> {
    if (this.hasShownThisSession) return;
    this.hasShownThisSession = true;
    let runs;
    try {
      runs = await firstValueFrom(this.workflowService.listActive());
    } catch {
      return;
    }
    const cutoff = Date.now() - WorkflowResumeService.RECENT_WINDOW_MS;
    const recent = runs.filter(r => Date.parse(r.lastActivityAt) >= cutoff);
    if (recent.length === 0) return;

    this.snackbar.info(
      `You have ${recent.length} workflow draft${recent.length === 1 ? '' : 's'} in progress. Tap to resume.`,
    );
    // The snackbar is informational — open the active list immediately
    // (one click cost) so the user can resume without hunting for a
    // dashboard widget.
    this.openActiveList();
  }

  /** Open the active runs list dialog programmatically. */
  openActiveList(): void {
    this.dialog.open(WorkflowActiveListDialogComponent, {
      panelClass: 'workflow-active-list-panel',
      autoFocus: 'first-tabbable',
    });
  }
}
