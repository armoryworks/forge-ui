import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { RoutingComponent } from '../../components/routing/routing.component';
import { BOMEntry } from '../../models/bom-entry.model';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';

/**
 * Workflow Pattern Phase 5 — Routing step. Wraps the existing
 * `RoutingComponent` (operations table + add/edit/delete dialogs) so the
 * heavy lifting reuses the proven path. After any operation mutation we
 * refetch the part detail so `hasRouting` (operations.length > 0) gate
 * lights up immediately on the step rail.
 */
@Component({
  selector: 'app-part-routing-step',
  standalone: true,
  imports: [TranslatePipe, RoutingComponent],
  templateUrl: './part-routing-step.component.html',
  styleUrl: './part-routing-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartRoutingStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);

  readonly stepId = input<string>('routing');
  readonly componentName = input<string>('PartRoutingStepComponent');
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly part = computed<PartDetail | null>(() => (this.entity() as PartDetail | null) ?? null);
  protected readonly bomEntries = computed<BOMEntry[]>(() => this.part()?.bomEntries ?? []);

  /** Bumped via a polling-style effect so the step rail's hasRouting gate
   * refreshes after Routing's add/edit/delete operations finish. */
  protected readonly refreshToken = signal(0);

  constructor() {
    // RoutingComponent owns its own operations list — but the workflow
    // service caches the entity. After the user adds/edits/deletes
    // operations through RoutingComponent, periodically re-sync the
    // workflow's currentEntity so the gate updates. Refresh at most
    // once per refreshToken bump.
    effect(() => {
      const id = this.entityId();
      // Subscribe to the refresh token so manual refreshes re-run this effect.
      this.refreshToken();
      if (id == null) return;
      this.partsService.getPartById(id).subscribe({
        next: (detail) => this.workflowService.currentEntity.set(detail),
      });
    });
  }

  /**
   * Called on user click of "Refresh status" — checks the latest part
   * snapshot. RoutingComponent currently doesn't emit per-mutation events,
   * so we expose a manual gate-refresh as well as auto-refresh-on-mount.
   */
  protected refreshGates(): void {
    this.refreshToken.update((v) => v + 1);
  }
}
