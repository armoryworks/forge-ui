import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-quick-action-panel',
  standalone: true,
  templateUrl: './quick-action-panel.component.html',
  styleUrl: './quick-action-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickActionPanelComponent {
  readonly actions = input.required<QuickAction[]>();
  readonly columns = input<number>(3);

  readonly actionClick = output<string>();

  protected onAction(action: QuickAction): void {
    if (!action.disabled) {
      this.actionClick.emit(action.id);
    }
  }
}
