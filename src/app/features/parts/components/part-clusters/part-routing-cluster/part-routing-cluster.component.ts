import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RoutingComponent } from '../../routing/routing.component';
import { PartDetail } from '../../../models/part-detail.model';

/**
 * Pillar 4 Phase 2 — Routing cluster.
 *
 * Thin wrapper around the canonical <app-routing> viewer. Operations
 * CRUD lives in the existing OperationDialogComponent which Routing
 * already orchestrates; this cluster keeps the surface area aligned with
 * the cluster pattern even though the routing viewer is the heavyweight.
 */
@Component({
  selector: 'app-part-routing-cluster',
  standalone: true,
  imports: [RoutingComponent],
  templateUrl: './part-routing-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartRoutingClusterComponent {
  readonly entity = input.required<PartDetail>();
  readonly editing = input(false);
}
