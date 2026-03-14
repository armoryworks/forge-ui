import { NavItem } from './nav-item.model';

export interface NavGroup {
  label?: string;
  items: NavItem[];
}
