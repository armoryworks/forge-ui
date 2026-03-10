export interface DashboardWidgetConfig {
  id: string;
  title: string;
  icon: string;
  component: string;
  defaultX: number;
  defaultY: number;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
}
