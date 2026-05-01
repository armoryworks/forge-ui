import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';

/**
 * Pillar 5 — Customer activity cluster. Thin wrapper around the existing
 * shared `<app-entity-activity-section>` so the Activity tab on the Customer
 * detail page has a consistent cluster facade matching the Part decomposition.
 */
@Component({
  selector: 'app-customer-activity-cluster',
  standalone: true,
  imports: [EntityActivitySectionComponent],
  template: `
    <div class="cluster">
      <app-entity-activity-section entityType="Customer" [entityId]="customerId()" />
    </div>
  `,
  styleUrl: './customer-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActivityClusterComponent {
  readonly customerId = input.required<number>();
}
