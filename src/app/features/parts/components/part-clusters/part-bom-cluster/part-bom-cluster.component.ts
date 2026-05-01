import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { BomTreeComponent } from '../../bom-tree/bom-tree.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { PartDetail } from '../../../models/part-detail.model';

/**
 * Pillar 4 Phase 2 — BOM cluster.
 *
 * Thin wrapper around <app-bom-tree>. Edit/add/delete actions remain in
 * the part detail panel's existing BOM tab orchestration; this cluster
 * surfaces the read-only tree view as the canonical BOM presentation in
 * the cluster system. Polish (inline edits inside the cluster, mode
 * toggle) is deferred to a future dispatch.
 */
@Component({
  selector: 'app-part-bom-cluster',
  standalone: true,
  imports: [TranslatePipe, BomTreeComponent, EmptyStateComponent],
  templateUrl: './part-bom-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartBomClusterComponent {
  readonly entity = input.required<PartDetail>();
  readonly editing = input(false);
}
