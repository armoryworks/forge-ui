import { NavItem } from './nav-item.model';

export interface NavGroup {
  label?: string;
  i18nKey?: string;
  items: NavItem[];
}
