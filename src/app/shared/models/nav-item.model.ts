export interface NavItem {
  icon: string;
  label: string;
  i18nKey?: string;
  route?: string;
  routePrefix?: string;
  badge?: number;
  shortcut?: string[];
  allowedRoles?: string[];
  /** Hide this item (and its group) unless the given capability is enabled in the current snapshot. */
  capability?: string;
  children?: NavItem[];
}
