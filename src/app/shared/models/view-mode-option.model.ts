/** One segment of a view-mode toggle: the mode it selects, its icon and its translated label. */
export interface ViewModeOption<T extends string = string> {
  mode: T;
  icon: string;
  labelKey: string;
}
