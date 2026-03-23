export interface QuickRefItem {
  label: string;
  value: string;
}

export interface QuickRefGroup {
  heading: string;
  items: QuickRefItem[];
}

export interface QuickRefContent {
  title: string;
  groups: QuickRefGroup[];
}
