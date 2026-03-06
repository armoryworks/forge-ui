import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { ActivityEntry } from '../models/dashboard.model';
import { MOCK_ACTIVITY } from '../services/dashboard-mock.data';

@Component({
  selector: 'app-activity-widget',
  standalone: true,
  templateUrl: './activity-widget.component.html',
  styleUrl: './activity-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityWidgetComponent {
  protected readonly entries = signal<ActivityEntry[]>(MOCK_ACTIVITY);
}
