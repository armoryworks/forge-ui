import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ActivityEntry } from '../models/activity-entry.model';

@Component({
  selector: 'app-activity-widget',
  standalone: true,
  templateUrl: './activity-widget.component.html',
  styleUrl: './activity-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityWidgetComponent {
  readonly entries = input.required<ActivityEntry[]>();
}
