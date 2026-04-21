import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TruncationTooltipDirective } from '../../../shared/directives/truncation-tooltip.directive';
import { DeadlineEntry } from '../models/deadline-entry.model';

const MAX_VISIBLE = 6;

@Component({
  selector: 'app-deadlines-widget',
  standalone: true,
  imports: [TruncationTooltipDirective],
  templateUrl: './deadlines-widget.component.html',
  styleUrl: './deadlines-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlinesWidgetComponent {
  readonly deadlines = input.required<DeadlineEntry[]>();

  protected readonly visibleDeadlines = computed(() =>
    this.deadlines().slice(0, MAX_VISIBLE),
  );
}
