import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DeadlineEntry } from '../models/dashboard.model';

@Component({
  selector: 'app-deadlines-widget',
  standalone: true,
  templateUrl: './deadlines-widget.component.html',
  styleUrl: './deadlines-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlinesWidgetComponent {
  readonly deadlines = input.required<DeadlineEntry[]>();
}
