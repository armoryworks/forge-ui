import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { NavGroup } from '../../shared/models/nav-group.model';
import { NavItem } from '../../shared/models/nav-item.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  protected readonly collapsed = signal(this.loadCollapsedState());

  private readonly allNavGroups: NavGroup[] = [
    {
      items: [
        { icon: 'dashboard', label: 'Dashboard', route: '/dashboard' },
        { icon: 'view_kanban', label: 'Board', route: '/kanban', allowedRoles: ['Admin', 'Manager', 'Engineer', 'ProductionWorker'] },
        { icon: 'inbox', label: 'Backlog', route: '/backlog', allowedRoles: ['Admin', 'Manager', 'PM', 'Engineer'] },
        { icon: 'event_note', label: 'Planning', route: '/planning', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'calendar_month', label: 'Calendar', route: '/calendar' },
      ],
    },
    {
      items: [
        { icon: 'precision_manufacturing', label: 'Parts', route: '/parts', allowedRoles: ['Admin', 'Manager', 'Engineer', 'PM'] },
        { icon: 'inventory_2', label: 'Inventory', route: '/inventory', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'people', label: 'Customers', route: '/customers', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'local_shipping', label: 'Vendors', route: '/vendors', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'description', label: 'POs', route: '/purchase-orders', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'request_quote', label: 'Quotes', route: '/quotes', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'shopping_cart', label: 'Orders', route: '/sales-orders', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'package_2', label: 'Shipments', route: '/shipments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'receipt', label: 'Invoices', route: '/invoices', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'payments', label: 'Payments', route: '/payments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'people_outline', label: 'Leads', route: '/leads', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'receipt_long', label: 'Expenses', route: '/expenses', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
      ],
    },
    {
      items: [
        { icon: 'build', label: 'Assets', route: '/assets', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'schedule', label: 'Time', route: '/time-tracking' },
        { icon: 'bar_chart', label: 'Reports', route: '/reports', allowedRoles: ['Admin', 'Manager', 'PM'] },
      ],
    },
  ];

  private readonly allBottomItems: NavGroup = {
    items: [{ icon: 'settings', label: 'Admin', route: '/admin', allowedRoles: ['Admin'] }],
  };

  protected readonly navGroups = computed(() => this.filterGroups(this.allNavGroups));
  protected readonly bottomItems = computed(() => this.filterGroup(this.allBottomItems));

  protected toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem('qbe-sidebar-collapsed', String(next));
  }

  private filterGroups(groups: NavGroup[]): NavGroup[] {
    return groups
      .map(g => this.filterGroup(g))
      .filter(g => g.items.length > 0);
  }

  private filterGroup(group: NavGroup): NavGroup {
    return {
      items: group.items.filter(item => this.isAllowed(item)),
    };
  }

  private isAllowed(item: NavItem): boolean {
    if (!item.allowedRoles) return true;
    return this.auth.hasAnyRole(item.allowedRoles);
  }

  private loadCollapsedState(): boolean {
    return localStorage.getItem('qbe-sidebar-collapsed') !== 'false';
  }
}
