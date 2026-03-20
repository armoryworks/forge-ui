import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-kanban-column-header',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './kanban-column-header.component.html',
  styleUrl: './kanban-column-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanColumnHeaderComponent {
  readonly name = input.required<string>();
  readonly count = input(0);
  readonly wipLimit = input<number | null>(null);
  readonly color = input<string>('var(--primary)');
  readonly isIrreversible = input(false);
  readonly collapsed = input(false);

  readonly collapseToggled = output<void>();

  protected readonly isOverWip = computed(() => {
    const limit = this.wipLimit();
    return limit !== null && this.count() > limit;
  });
}
