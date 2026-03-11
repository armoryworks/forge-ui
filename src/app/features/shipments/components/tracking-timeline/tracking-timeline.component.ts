import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { ShipmentTracking } from '../../models/shipment-tracking.model';

@Component({
  selector: 'app-tracking-timeline',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './tracking-timeline.component.html',
  styleUrl: './tracking-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingTimelineComponent {
  readonly tracking = input.required<ShipmentTracking>();
}
