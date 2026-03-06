export interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

export interface NavGroup {
  items: NavItem[];
}
