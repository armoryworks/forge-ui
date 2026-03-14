import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { LayoutService } from '../../shared/services/layout.service';
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
  protected readonly layout = inject(LayoutService);

  protected readonly collapsed = computed(() => !this.layout.sidebarExpanded());

  private readonly allNavGroups: NavGroup[] = [
    {
      label: 'Operations',
      items: [
        { icon: 'dashboard', label: 'Dashboard', route: '/dashboard', shortcut: 'G' },
        { icon: 'view_kanban', label: 'Board', route: '/kanban', shortcut: 'K', allowedRoles: ['Admin', 'Manager', 'Engineer', 'ProductionWorker'] },
        { icon: 'inbox', label: 'Backlog', route: '/backlog', shortcut: 'B', allowedRoles: ['Admin', 'Manager', 'PM', 'Engineer'] },
        { icon: 'event_note', label: 'Planning', route: '/planning', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'calendar_month', label: 'Calendar', route: '/calendar' },
      ],
    },
    {
      label: 'Sales',
      items: [
        { icon: 'people', label: 'Customers', route: '/customers', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'people_outline', label: 'Leads', route: '/leads', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'request_quote', label: 'Quotes', route: '/quotes', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'shopping_cart', label: 'Orders', route: '/sales-orders', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'outbox', label: 'Shipments', route: '/shipments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'receipt', label: 'Invoices', route: '/invoices', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'payments', label: 'Payments', route: '/payments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
    {
      label: 'Supply',
      items: [
        { icon: 'precision_manufacturing', label: 'Parts', route: '/parts', shortcut: 'P', allowedRoles: ['Admin', 'Manager', 'Engineer', 'PM'] },
        { icon: 'inventory_2', label: 'Inventory', route: '/inventory', shortcut: 'I', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'local_shipping', label: 'Vendors', route: '/vendors', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'description', label: 'POs', route: '/purchase-orders', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
    {
      label: 'Resources',
      items: [
        { icon: 'build', label: 'Assets', route: '/assets', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'schedule', label: 'Time', route: '/time-tracking', shortcut: 'T' },
        { icon: 'receipt_long', label: 'Expenses', route: '/expenses', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'bar_chart', label: 'Reports', route: '/reports', shortcut: 'R', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'smart_toy', label: 'AI', route: '/ai' },
      ],
    },
  ];

  private readonly allBottomItems: NavGroup = {
    items: [
      { icon: 'storefront', label: 'Shop Floor', route: '/admin/teams', allowedRoles: ['Admin', 'Manager'] },
      { icon: 'settings', label: 'Admin', route: '/admin', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
    ],
  };

  protected readonly navGroups = computed(() => this.filterGroups(this.allNavGroups));
  protected readonly bottomItems = computed(() => this.filterGroup(this.allBottomItems));

  protected toggleCollapse(): void {
    this.layout.toggleSidebar();
  }

  protected onNavClick(): void {
    if (this.layout.isMobile()) {
      this.layout.closeMobileMenu();
    }
  }

  private filterGroups(groups: NavGroup[]): NavGroup[] {
    return groups
      .map(g => this.filterGroup(g))
      .filter(g => g.items.length > 0);
  }

  private filterGroup(group: NavGroup): NavGroup {
    return {
      label: group.label,
      items: group.items.filter(item => this.isAllowed(item)),
    };
  }

  private isAllowed(item: NavItem): boolean {
    if (!item.allowedRoles) return true;
    return this.auth.hasAnyRole(item.allowedRoles);
  }

}
