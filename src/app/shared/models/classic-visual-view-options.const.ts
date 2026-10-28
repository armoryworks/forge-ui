import { ViewMode } from './view-mode.model';
import { ViewModeOption } from './view-mode-option.model';

/** The Classic (table) / Visual (chart) segments the view-mode toggle shows by default. */
export const CLASSIC_VISUAL_VIEW_OPTIONS: readonly ViewModeOption<ViewMode>[] = [
  { mode: 'classic', icon: 'table_rows', labelKey: 'common.viewClassic' },
  { mode: 'visual', icon: 'insights', labelKey: 'common.viewVisual' },
];
