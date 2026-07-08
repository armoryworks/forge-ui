import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CustomerService } from '../../services/customer.service';
import { CustomerSummary } from '../../models/customer-summary.model';
import {
  CustomerDetailLayoutResolverService,
  CustomerDetailTabId,
  TabLayoutEntry,
} from '../../services/customer-detail-layout-resolver.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CustomerOverviewTabComponent } from './tabs/customer-overview-tab.component';
import { CustomerEstimatesTabComponent } from './tabs/customer-estimates-tab.component';
import { CustomerQuotesTabComponent } from './tabs/customer-quotes-tab.component';
import { CustomerOrdersTabComponent } from './tabs/customer-orders-tab.component';
import { CustomerJobsTabComponent } from './tabs/customer-jobs-tab.component';
import { CustomerInvoicesTabComponent } from './tabs/customer-invoices-tab.component';
import { CustomerActivityTabComponent } from './tabs/customer-activity-tab.component';
import { CustomerPricingTabComponent } from './tabs/customer-pricing-tab.component';
import { CustomerIdentityClusterComponent } from '../../components/customer-clusters/customer-identity-cluster.component';
import { CustomerActivityClusterComponent } from '../../components/customer-clusters/customer-activity-cluster.component';
// Wave 6 — Contacts/Addresses/Interactions are now clusters (moved from
// pages/customer-detail/tabs/ to components/customer-clusters/) so the
// customer detail tree mirrors Parts' cluster naming convention. The
// remaining tab components are query-shaped (read-only list views) and
// stay as tabs.
import { CustomerContactsClusterComponent } from '../../components/customer-clusters/customer-contacts-cluster.component';
import { CustomerAddressesClusterComponent } from '../../components/customer-clusters/customer-addresses-cluster.component';
import { CustomerInteractionsClusterComponent } from '../../components/customer-clusters/customer-interactions-cluster.component';
import { CustomerDocumentsClusterComponent } from '../../components/customer-clusters/customer-documents-cluster.component';
// S1 — tax certificates co-located inside the Documents tab, below the
// general documents list (they're files first; no dedicated tab needed).
import { CustomerTaxDocumentsClusterComponent } from '../../components/customer-clusters/customer-tax-documents-cluster.component';
// S3 — Customer-scope terms & conditions, co-located in the Documents tab
// below the general documents + tax certificates. Reusable across parts too.
import { TermsSectionComponent } from '../../../terms/components/terms-section/terms-section.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { EntityCompletenessChipComponent } from '../../../../shared/components/entity-completeness-chip/entity-completeness-chip.component';

/**
 * Pillar 5 — Customer detail shell.
 *
 * Tabs are driven by `CustomerDetailLayoutResolverService.resolve(...)` which
 * maps the customer's lifecycle bucket (Active / Prospect / Archived, derived
 * from `IsActive` + open-doc counts) to an ordered list of tab descriptors.
 * Identity (overview) is always first; Activity always last.
 *
 * Existing per-tab components (`customer-{tab}-tab.component`) continue to
 * surface through the resolver-driven shell. The `overview` tab now mounts
 * the new `<app-customer-identity-cluster>` (read + edit). The `activity`
 * tab mounts the new `<app-customer-activity-cluster>` (wraps the shared
 * `<app-entity-activity-section>`).
 *
 * Spec source of truth: `docs/entity-detail-pattern.md` § 6.
 */
@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    TranslatePipe, RouterLink, MatTooltipModule,
    CustomerOverviewTabComponent,
    CustomerEstimatesTabComponent, CustomerQuotesTabComponent, CustomerOrdersTabComponent,
    CustomerJobsTabComponent, CustomerInvoicesTabComponent, CustomerActivityTabComponent,
    CustomerPricingTabComponent,
    CustomerIdentityClusterComponent, CustomerActivityClusterComponent,
    CustomerContactsClusterComponent, CustomerAddressesClusterComponent, CustomerInteractionsClusterComponent,
    CustomerDocumentsClusterComponent,
    CustomerTaxDocumentsClusterComponent,
    TermsSectionComponent,
    CurrencyDisplayComponent,
    EntityCompletenessChipComponent,
  ],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly layoutResolver = inject(CustomerDetailLayoutResolverService);
  private readonly capabilityService = inject(CapabilityService);

  /**
   * Wave 5 — Tabs whose entire surface is capability-gated. The resolver
   * returns the unfiltered logical layout; we drop tabs whose capability
   * isn't enabled before rendering, matching the gating already applied
   * to the corresponding controllers.
   */
  private readonly tabCapabilityMap: Partial<Record<CustomerDetailTabId, string>> = {
    contacts: 'CAP-MD-CUSTOMER-CONTACTS',
    addresses: 'CAP-MD-CUSTOMER-ADDRESSES',
    interactions: 'CAP-MD-CUSTOMER-INTERACTIONS',
  };

  protected readonly customerId = toSignal(
    this.route.paramMap.pipe(map(p => +p.get('id')!)),
    { initialValue: 0 },
  );

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') ?? 'overview') as CustomerDetailTabId)),
    { initialValue: 'overview' as CustomerDetailTabId },
  );

  protected readonly customer = signal<CustomerSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);

  /**
   * Pillar 5 — Resolved tab layout for the loaded Customer. Derived from the
   * customer's lifecycle bucket via `deriveLifecycle(...)`.
   */
  protected readonly tabLayout = computed<TabLayoutEntry[]>(() => {
    const c = this.customer();
    if (!c) return [];
    const lifecycle = this.layoutResolver.deriveLifecycle(c);
    const layout = this.layoutResolver.resolve(lifecycle);
    // Wave 5 — drop tabs whose backing capability is disabled. The
    // capability snapshot is reactive; toggling a capability on/off
    // remounts the layout without a manual reload.
    return layout.filter(tab => {
      const cap = this.tabCapabilityMap[tab.id];
      return !cap || this.capabilityService.isEnabled(cap);
    });
  });

  /**
   * Wave 5 — Bound to the credit-status card's `*appCap`. Returns true
   * only when CAP-O2C-CREDIT-LIMITS is enabled. COD / prepaid shops
   * disable the card entirely.
   */
  protected readonly creditLimitsEnabled = computed(() =>
    this.capabilityService.isEnabled('CAP-O2C-CREDIT-LIMITS'));

  constructor() {
    effect(() => {
      const id = this.customerId();
      if (id > 0) this.loadCustomer(id);
    });

    // If the resolver no longer surfaces the active tab (e.g. customer
    // archived → Orders tab disappears), fall back to the first tab.
    effect(() => {
      const layout = this.tabLayout();
      if (layout.length === 0) return;
      const current = this.activeTab();
      if (!layout.some(t => t.id === current)) {
        const fallback = layout[0].id;
        this.router.navigate(['..', fallback], { relativeTo: this.route, replaceUrl: true });
      }
    });
  }

  private loadCustomer(id: number): void {
    this.loading.set(true);
    this.customerService.getCustomerSummary(id).subscribe({
      next: c => {
        this.customer.set(c);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/customers']);
      },
    });
  }

  protected reloadCustomer(): void {
    const id = this.customerId();
    if (id > 0) this.loadCustomer(id);
  }

  protected switchTab(tab: CustomerDetailTabId): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected toggleEdit(): void {
    this.editing.update(v => !v);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  /**
   * Pillar 5 — Generic save handler used by the identity cluster (and any
   * future editable cluster). The cluster emits a `Partial<CustomerSummary>`
   * patch; we map onto `UpdateCustomerRequest` and refresh.
   */
  protected saveClusterPatch(patch: Partial<CustomerSummary>): void {
    const c = this.customer();
    if (!c) return;
    this.saving.set(true);
    this.customerService.updateCustomer(c.id, {
      name: patch.name ?? c.name,
      companyName: patch.companyName ?? c.companyName,
      email: patch.email ?? c.email,
      phone: patch.phone ?? c.phone,
      isActive: patch.isActive ?? c.isActive,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.loadCustomer(c.id);
        this.snackbar.success(this.translate.instant('customers.saved'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected archiveCustomer(): void {
    const c = this.customer();
    if (!c) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.archiveTitle'),
        message: this.translate.instant('customers.archiveMessage'),
        confirmLabel: this.translate.instant('common.archive'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.deleteCustomer(c.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('customers.archived'));
          this.router.navigate(['/customers']);
        },
      });
    });
  }
}
