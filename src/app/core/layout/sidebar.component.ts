import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NavGroup } from '../../shared/models/nav-item.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  protected readonly collapsed = signal(this.loadCollapsedState());

  protected readonly navGroups: NavGroup[] = [
    {
      items: [
        { icon: 'dashboard', label: 'Dashboard', route: '/dashboard' },
        { icon: 'view_kanban', label: 'Board', route: '/kanban' },
        { icon: 'inbox', label: 'Backlog', route: '/backlog', badge: 12 },
        { icon: 'calendar_month', label: 'Calendar', route: '/calendar' },
      ],
    },
    {
      items: [
        { icon: 'precision_manufacturing', label: 'Parts', route: '/parts' },
        { icon: 'inventory_2', label: 'Inventory', route: '/inventory' },
        { icon: 'people_outline', label: 'Leads', route: '/leads' },
        { icon: 'receipt_long', label: 'Expenses', route: '/expenses' },
      ],
    },
    {
      items: [
        { icon: 'build', label: 'Assets', route: '/assets' },
        { icon: 'schedule', label: 'Time', route: '/time-tracking' },
        { icon: 'bar_chart', label: 'Reports', route: '/reports' },
      ],
    },
  ];

  protected readonly bottomItems: NavGroup = {
    items: [{ icon: 'settings', label: 'Admin', route: '/admin' }],
  };

  protected toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem('qbe-sidebar-collapsed', String(next));
  }

  private loadCollapsedState(): boolean {
    return localStorage.getItem('qbe-sidebar-collapsed') !== 'false';
  }
}
