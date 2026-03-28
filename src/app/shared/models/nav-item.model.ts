export interface NavItem {
  icon: string;
  label: string;
  i18nKey?: string;
  route: string;
  badge?: number;
  shortcut?: string[];
  allowedRoles?: string[];
  children?: NavItem[];
}
