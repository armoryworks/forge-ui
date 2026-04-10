import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

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
  private readonly router = inject(Router);

  protected readonly collapsed = computed(() => !this.layout.sidebarExpanded());

  protected readonly isAdminRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/admin')),
    ),
    { initialValue: this.router.url.startsWith('/admin') },
  );

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
        { icon: 'shopping_cart', label: 'Sales Orders', i18nKey: 'nav.salesOrders', route: '/sales-orders', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'outbox', label: 'Shipments', i18nKey: 'nav.shipments', route: '/shipments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'receipt', label: 'Invoices', i18nKey: 'nav.invoices', route: '/invoices', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'payments', label: 'Payments', i18nKey: 'nav.payments', route: '/payments', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'assignment_return', label: 'Customer Returns', i18nKey: 'nav.customerReturns', route: '/customer-returns', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
      ],
    },
    {
      label: 'Supply',
      i18nKey: 'navGroups.supply',
      items: [
        { icon: 'precision_manufacturing', label: 'Parts', i18nKey: 'nav.parts', route: '/parts', shortcut: ['Q', 'P'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'PM'] },
        { icon: 'inventory_2', label: 'Inventory', i18nKey: 'nav.inventory', route: '/inventory', shortcut: ['Q', 'I'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'batch_prediction', label: 'Lots', i18nKey: 'nav.lots', route: '/lots', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'local_shipping', label: 'Vendors', i18nKey: 'nav.vendors', route: '/vendors', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'description', label: 'Purchase Orders', i18nKey: 'nav.purchaseOrders', route: '/purchase-orders', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
    {
      label: 'Resources',
      i18nKey: 'navGroups.resources',
      items: [
        { icon: 'build', label: 'Assets', i18nKey: 'nav.assets', route: '/assets', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'schedule', label: 'Time', i18nKey: 'nav.timeTracking', route: '/time-tracking', shortcut: ['Q', 'T'] },
        { icon: 'badge', label: 'Employees', i18nKey: 'nav.employees', route: '/employees', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'receipt_long', label: 'Expenses', i18nKey: 'nav.expenses', route: '/expenses', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'bar_chart', label: 'Reports', i18nKey: 'nav.reports', route: '/reports', shortcut: ['Q', 'R'], allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'smart_toy', label: 'AI', i18nKey: 'nav.ai', route: '/ai' },
        { icon: 'school', label: 'Training', i18nKey: 'nav.training', route: '/training/library' },
      ],
    },
  ];

  private readonly allBottomItems: NavGroup = {
    items: [
      { icon: 'storefront', label: 'Shop Floor', i18nKey: 'nav.shopFloor', route: '/display/shop-floor', allowedRoles: ['Admin', 'Manager'] },
      {
        icon: 'settings', label: 'Admin', i18nKey: 'nav.admin', route: '/admin', allowedRoles: ['Admin', 'Manager', 'OfficeManager'],
        children: [
          { icon: 'people', label: 'Users', i18nKey: 'admin.tabs.users', route: '/admin/users', allowedRoles: ['Admin'] },
          { icon: 'route', label: 'Track Types', i18nKey: 'admin.tabs.trackTypes', route: '/admin/track-types', allowedRoles: ['Admin'] },
          { icon: 'dataset', label: 'Ref Data', i18nKey: 'admin.tabs.referenceData', route: '/admin/reference-data', allowedRoles: ['Admin'] },
          { icon: 'translate', label: 'Terminology', i18nKey: 'admin.tabs.terminology', route: '/admin/terminology', allowedRoles: ['Admin'] },
          { icon: 'settings', label: 'Settings', i18nKey: 'admin.tabs.settings', route: '/admin/settings', allowedRoles: ['Admin'] },
          { icon: 'hub', label: 'Integrations', i18nKey: 'admin.tabs.integrations', route: '/admin/integrations', allowedRoles: ['Admin'] },
          { icon: 'smart_toy', label: 'AI Assistants', i18nKey: 'admin.tabs.aiAssistants', route: '/admin/ai-assistants', allowedRoles: ['Admin'] },
          { icon: 'groups', label: 'Teams', i18nKey: 'admin.tabs.teams', route: '/admin/teams', allowedRoles: ['Admin'] },
          { icon: 'percent', label: 'Sales Tax', i18nKey: 'admin.tabs.salesTax', route: '/admin/sales-tax', allowedRoles: ['Admin'] },
          { icon: 'manage_search', label: 'Audit Log', i18nKey: 'admin.tabs.auditLog', route: '/admin/audit-log', allowedRoles: ['Admin'] },
          { icon: 'school', label: 'Training', i18nKey: 'admin.tabs.training', route: '/admin/training', allowedRoles: ['Admin', 'Manager'] },
          { icon: 'fact_check', label: 'Compliance', i18nKey: 'admin.tabs.compliance', route: '/admin/compliance', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        ],
      },
    ],
  };

  protected readonly adminChildren = computed(() => {
    const admin = this.allBottomItems.items.find(i => i.route === '/admin');
    if (!admin?.children) return [];
    return admin.children.filter(c => this.isAllowed(c));
  });

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
