import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { ViewMode } from '../../models/view-mode.model';
import { ViewModeOption } from '../../models/view-mode-option.model';
import { CLASSIC_VISUAL_VIEW_OPTIONS } from '../../models/classic-visual-view-options.const';

/**
 * Dumb segmented toggle between the presentations of a screen. By default it offers the
 * Classic (table) and Visual (chart) views, where the Classic table stays the source of
 * truth; pass `options` for another pair, such as the jobs board and table. Parent owns the
 * mode (URL + preference).
 */
@Component({
  selector: 'app-view-mode-toggle',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './view-mode-toggle.component.html',
  styleUrl: './view-mode-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewModeToggleComponent<T extends string = ViewMode> {
  readonly mode = input.required<T>();
  readonly options = input<readonly ViewModeOption<T>[]>(CLASSIC_VISUAL_VIEW_OPTIONS as unknown as readonly ViewModeOption<T>[]);
  readonly modeChange = output<T>();

  protected select(mode: T): void {
    if (mode !== this.mode()) this.modeChange.emit(mode);
  }
}
