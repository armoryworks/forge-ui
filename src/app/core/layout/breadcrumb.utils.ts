import { NavItem } from '../../shared/models/nav-item.model';

export function collapseRepeatedCrumbs(trail: readonly NavItem[]): NavItem[] {
  return trail.filter((crumb, i) => i === trail.length - 1 || crumb.label !== trail[i + 1].label);
}
