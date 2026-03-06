import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { DeadlineEntry } from '../models/dashboard.model';
import { MOCK_DEADLINES } from '../services/dashboard-mock.data';

@Component({
  selector: 'app-deadlines-widget',
  standalone: true,
  templateUrl: './deadlines-widget.component.html',
  styleUrl: './deadlines-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlinesWidgetComponent {
  protected readonly deadlines = signal<DeadlineEntry[]>(MOCK_DEADLINES);
}
