import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { priorityStyle } from '../../models/priority.const';

/**
 * Colorblind-safe priority indicator: a distinct SHAPE (circle/square/triangle/
 * diamond) filled with the canonical priority color, so meaning is never conveyed
 * by color alone (WCAG 2.2 AA). Dumb/presentational — inputs only, no services.
 */
@Component({
  selector: 'app-priority-indicator',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './priority-indicator.component.html',
  styleUrl: './priority-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriorityIndicatorComponent {
  readonly priority = input.required<string>();
  readonly showLabel = input(false);
  readonly size = input<'sm' | 'md'>('md');

  protected readonly style = computed(() => priorityStyle(this.priority()));
}
