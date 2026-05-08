import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';

/**
 * Pillar 4 — Activity cluster. Thin wrapper around the existing shared
 * `<app-entity-activity-section>` so the Activity tab on the Part detail
 * page has a consistent cluster facade.
 */
@Component({
  selector: 'app-part-activity-cluster',
  standalone: true,
  imports: [EntityActivitySectionComponent],
  templateUrl: './part-activity-cluster.component.html',
  styleUrl: './part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartActivityClusterComponent {
  readonly partId = input.required<number>();
}
