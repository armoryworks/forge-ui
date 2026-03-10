export interface DashboardWidgetLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardSavedLayout {
  widgets: DashboardWidgetLayout[];
}
