import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { ShipmentTracking } from '../../models/shipment-tracking.model';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';

@Component({
  selector: 'app-tracking-timeline',
  standalone: true,
  imports: [DatePipe, DateTimePipe, TranslatePipe],
  templateUrl: './tracking-timeline.component.html',
  styleUrl: './tracking-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingTimelineComponent {
  readonly tracking = input.required<ShipmentTracking>();
}
