export interface DashboardWidgetConfig {
  id: string;
  titleKey: string;
  icon: string;
  component: string;
  /**
   * Capability gating this widget. Omitted = universal (always shown). Lets the
   * dashboard reflect the active modules — an inventory-only install never shows
   * the job/order/accounting widgets.
   */
  capability?: string;
  /**
   * Roles allowed to see this widget. Omitted = every role. Set when the widget's
   * endpoint is role-restricted, so a user never gets a widget that can only 403.
   */
  roles?: string[];
  defaultX: number;
  defaultY: number;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  viewAllLink?: string;
  viewAllLabelKey?: string;
}
