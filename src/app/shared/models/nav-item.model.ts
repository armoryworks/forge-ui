export interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
  allowedRoles?: string[];
}
