import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-list-panel',
  standalone: true,
  imports: [EmptyStateComponent],
  templateUrl: './list-panel.component.html',
  styleUrl: './list-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPanelComponent {
  readonly empty = input(false);
  readonly emptyIcon = input<string>('inbox');
  readonly emptyMessage = input<string>('No items');
}
