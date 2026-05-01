import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PartAlternatesTabComponent } from '../../part-alternates-tab/part-alternates-tab.component';
import { PartDetail } from '../../../models/part-detail.model';

/**
 * Pillar 4 Phase 2 — Alternates cluster.
 *
 * Thin wrapper around <app-part-alternates-tab>, which is already
 * partId-driven and self-managing. Listed here for parity with the
 * cluster system; future polish may inline the alternates UI directly.
 */
@Component({
  selector: 'app-part-alternates-cluster',
  standalone: true,
  imports: [PartAlternatesTabComponent],
  templateUrl: './part-alternates-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartAlternatesClusterComponent {
  readonly entity = input.required<PartDetail>();
  readonly editing = input(false);
}
