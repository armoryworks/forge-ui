export interface DashboardWidgetConfig {
  id: string;
  title: string;
  icon: string;
  component: string;
  /**
   * Capability gating this widget. Omitted = universal (always shown). Lets the
   * dashboard reflect the active modules — an inventory-only install never shows
   * the job/order/accounting widgets.
   */
  capability?: string;
  defaultX: number;
  defaultY: number;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  viewAllLink?: string;
  viewAllLabel?: string;
}
