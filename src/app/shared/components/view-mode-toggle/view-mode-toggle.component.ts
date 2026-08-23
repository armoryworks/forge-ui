import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { AccountingViewMode } from '../../models/accounting-view.model';

/**
 * Dumb segmented toggle between the Classic (table) and Visual (chart) view of a
 * screen. The Classic table stays the source of truth; Visual is the alternate
 * presentation for visual learners. Parent owns the mode (URL + preference).
 */
@Component({
  selector: 'app-view-mode-toggle',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './view-mode-toggle.component.html',
  styleUrl: './view-mode-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewModeToggleComponent {
  readonly mode = input.required<AccountingViewMode>();
  readonly modeChange = output<AccountingViewMode>();

  protected select(mode: AccountingViewMode): void {
    if (mode !== this.mode()) this.modeChange.emit(mode);
  }
}
