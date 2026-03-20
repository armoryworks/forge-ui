import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../shared/services/auth.service';
import { LayoutService } from '../../shared/services/layout.service';
import { NavGroup } from '../../shared/models/nav-group.model';
import { NavItem } from '../../shared/models/nav-item.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatTooltipModule, TranslatePipe],
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
      i18nKey: 'navGroups.operations',
      items: [
        { icon: 'dashboard', label: 'Dashboard', i18nKey: 'nav.dashboard', route: '/dashboard', shortcut: ['Q', 'D'] },
        { icon: 'view_kanban', label: 'Board', i18nKey: 'nav.kanban', route: '/kanban', shortcut: ['Q', 'K'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'ProductionWorker'] },
        { icon: 'inbox', label: 'Backlog', i18nKey: 'nav.backlog', route: '/backlog', shortcut: ['Q', 'B'], allowedRoles: ['Admin', 'Manager', 'PM', 'Engineer'] },
        { icon: 'event_note', label: 'Planning', i18nKey: 'nav.planning', route: '/planning', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'calendar_month', label: 'Calendar', i18nKey: 'nav.calendar', route: '/calendar' },
      ],
    },
    {
      label: 'Sales',
      i18nKey: 'navGroups.sales',
      items: [
        { icon: 'people', label: 'Customers', i18nKey: 'nav.customers', route: '/customers', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'people_outline', label: 'Leads', i18nKey: 'nav.leads', route: '/leads', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'request_quote', label: 'Quotes', i18nKey: 'nav.quotes', route: '/quotes', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'shopping_cart', label: 'Orders', i18nKey: 'nav.salesOrders', route: '/sales-orders', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'outbox', label: 'Shipments', i18nKey: 'nav.shipments', route: '/shipments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'receipt', label: 'Invoices', i18nKey: 'nav.invoices', route: '/invoices', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'payments', label: 'Payments', i18nKey: 'nav.payments', route: '/payments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
    {
      label: 'Supply',
      i18nKey: 'navGroups.supply',
      items: [
        { icon: 'precision_manufacturing', label: 'Parts', i18nKey: 'nav.parts', route: '/parts', shortcut: ['Q', 'P'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'PM'] },
        { icon: 'inventory_2', label: 'Inventory', i18nKey: 'nav.inventory', route: '/inventory', shortcut: ['Q', 'I'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'local_shipping', label: 'Vendors', i18nKey: 'nav.vendors', route: '/vendors', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'description', label: 'POs', i18nKey: 'nav.purchaseOrders', route: '/purchase-orders', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
    {
      label: 'Resources',
      i18nKey: 'navGroups.resources',
      items: [
        { icon: 'build', label: 'Assets', i18nKey: 'nav.assets', route: '/assets', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'schedule', label: 'Time', i18nKey: 'nav.timeTracking', route: '/time-tracking', shortcut: ['Q', 'T'] },
        { icon: 'receipt_long', label: 'Expenses', i18nKey: 'nav.expenses', route: '/expenses', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'bar_chart', label: 'Reports', i18nKey: 'nav.reports', route: '/reports', shortcut: ['Q', 'R'], allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'smart_toy', label: 'AI', i18nKey: 'nav.ai', route: '/ai' },
      ],
    },
  ];

  private readonly allBottomItems: NavGroup = {
    items: [
      { icon: 'storefront', label: 'Shop Floor', i18nKey: 'nav.shopFloor', route: '/worker', allowedRoles: ['Admin', 'Manager'] },
      { icon: 'settings', label: 'Admin', i18nKey: 'nav.admin', route: '/admin', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
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
      i18nKey: group.i18nKey,
      items: group.items.filter(item => this.isAllowed(item)),
    };
  }

  private isAllowed(item: NavItem): boolean {
    if (!item.allowedRoles) return true;
    return this.auth.hasAnyRole(item.allowedRoles);
  }

}
