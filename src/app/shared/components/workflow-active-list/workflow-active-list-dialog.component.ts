import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { WorkflowRun } from '../../models/workflow-run.model';
import { WorkflowService } from '../../services/workflow.service';

/**
 * Workflow Pattern Phase 4 — Active workflow runs list dialog.
 *
 * Lists every in-flight workflow_run for the current user (server-side
 * filter — `started_by_user_id == me && completed_at is null && abandoned_at is null`).
 * Click-to-resume routes to the entity's detail page with `?workflow=<definitionId>`.
 *
 * Surfaced via:
 *   • Post-login soft-prompt snackbar's "Resume drafts" action button
 *   • Dashboard widget (Phase 5+)
 *   • Workflow shell's close-confirm "Don't lose your draft" action
 */
@Component({
  selector: 'app-workflow-active-list-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, DatePipe],
  templateUrl: './workflow-active-list-dialog.component.html',
  styleUrl: './workflow-active-list-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowActiveListDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<WorkflowActiveListDialogComponent>);
  private readonly workflowService = inject(WorkflowService);
  private readonly router = inject(Router);

  protected readonly runs = signal<WorkflowRun[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loading.set(true);
    this.workflowService.listActive().subscribe({
      next: (runs) => {
        this.runs.set(runs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('workflow.shell.resume.loadFailed');
        this.loading.set(false);
      },
    });
  }

  protected resume(run: WorkflowRun): void {
    // Deferred materialization: a run with a null entityId hasn't completed
    // its first step yet, so there's no detail route to land on. Route to
    // the entity-less workflow path with `runId=` and let the workflow page
    // pick up where the user left off.
    if (run.entityId == null) {
      const segment = this.entityTypeSegment(run.entityType);
      this.router.navigate([`/${segment}/new`], {
        queryParams: { runId: run.id, workflow: run.definitionId, mode: run.mode },
      });
    } else {
      const route = this.entityRoute(run.entityType, run.entityId);
      this.router.navigate([route], {
        queryParams: { workflow: run.definitionId, mode: run.mode },
      });
    }
    this.dialogRef.close({ resumed: run.id });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  /**
   * Map an entity type → its detail route. Defaults to `/{type-lowercase-plural}/{id}`
   * which mirrors the project's REST route convention. Per-entity overrides
   * can land here when the entity's detail route shape differs.
   */
  private entityRoute(entityType: string, entityId: number): string {
    return `/${this.entityTypeSegment(entityType)}/${entityId}`;
  }

  private entityTypeSegment(entityType: string): string {
    const lower = entityType.toLowerCase();
    return lower.endsWith('s') ? lower : `${lower}s`;
  }
}
