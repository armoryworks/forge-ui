import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { CalendarSuperGroup } from '../../models/calendar-super-group.model';

/**
 * compliance-calendar A-3: the overlay calendar's layer list. Dumb component — renders a
 * multi-select checkbox list of Super-Groups and emits the id toggled; the parent owns the
 * selected set (URL-backed).
 */
@Component({
  selector: 'app-calendar-layers',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './calendar-layers.component.html',
  styleUrl: './calendar-layers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarLayersComponent {
  readonly superGroups = input.required<CalendarSuperGroup[]>();
  readonly selectedGroupIds = input.required<number[]>();
  readonly toggled = output<number>();

  protected readonly rows = computed(() => {
    const selected = new Set(this.selectedGroupIds());
    return this.superGroups().map(g => ({
      id: g.id,
      name: g.name,
      color: g.color ?? 'var(--border)',
      selected: selected.has(g.id),
    }));
  });
}
