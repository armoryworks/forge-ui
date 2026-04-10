import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CustomerService } from '../../services/customer.service';
import { CustomerSummary } from '../../models/customer-summary.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { CustomerOverviewTabComponent } from './tabs/customer-overview-tab.component';
import { CustomerContactsTabComponent } from './tabs/customer-contacts-tab.component';
import { CustomerAddressesTabComponent } from './tabs/customer-addresses-tab.component';
import { CustomerEstimatesTabComponent } from './tabs/customer-estimates-tab.component';
import { CustomerQuotesTabComponent } from './tabs/customer-quotes-tab.component';
import { CustomerOrdersTabComponent } from './tabs/customer-orders-tab.component';
import { CustomerJobsTabComponent } from './tabs/customer-jobs-tab.component';
import { CustomerInvoicesTabComponent } from './tabs/customer-invoices-tab.component';
import { CustomerActivityTabComponent } from './tabs/customer-activity-tab.component';
import { CustomerInteractionsTabComponent } from './tabs/customer-interactions-tab.component';

const TABS = ['overview', 'contacts', 'interactions', 'addresses', 'estimates', 'quotes', 'orders', 'jobs', 'invoices', 'activity'] as const;
type CustomerTab = typeof TABS[number];

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, ReactiveFormsModule, TranslatePipe, RouterLink, MatTooltipModule,
    InputComponent, SelectComponent, DialogComponent, ValidationPopoverDirective,
    CustomerOverviewTabComponent, CustomerContactsTabComponent, CustomerAddressesTabComponent,
    CustomerEstimatesTabComponent, CustomerQuotesTabComponent, CustomerOrdersTabComponent,
    CustomerJobsTabComponent, CustomerInvoicesTabComponent, CustomerActivityTabComponent, CustomerInteractionsTabComponent,
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

  protected readonly customerId = toSignal(
    this.route.paramMap.pipe(map(p => +p.get('id')!)),
    { initialValue: 0 },
  );

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') ?? 'overview') as CustomerTab)),
    { initialValue: 'overview' as CustomerTab },
  );

  protected readonly customer = signal<CustomerSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly showEditDialog = signal(false);
  protected readonly saving = signal(false);

  protected readonly editForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    companyName: new FormControl(''),
    email: new FormControl('', [Validators.email, Validators.maxLength(200)]),
    phone: new FormControl(''),
    isActive: new FormControl(true),
  });

  protected readonly violations = computed(() =>
    FormValidationService.getViolations(this.editForm, {
      name: 'Name',
      email: 'Email',
    })
  );

  protected readonly tabs = TABS;

  constructor() {
    effect(() => {
      const id = this.customerId();
      if (id > 0) this.loadCustomer(id);
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

  protected switchTab(tab: CustomerTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected openEdit(): void {
    const c = this.customer();
    if (!c) return;
    this.editForm.patchValue({
      name: c.name,
      companyName: c.companyName ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      isActive: c.isActive,
    });
    this.showEditDialog.set(true);
  }

  protected closeEdit(): void {
    this.showEditDialog.set(false);
    this.editForm.reset();
  }

  protected saveEdit(): void {
    if (this.editForm.invalid || this.saving()) return;
    const id = this.customerId();
    const v = this.editForm.value;
    this.saving.set(true);
    this.customerService.updateCustomer(id, {
      name: v.name!,
      companyName: v.companyName ?? undefined,
      email: v.email ?? undefined,
      phone: v.phone ?? undefined,
      isActive: v.isActive ?? true,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showEditDialog.set(false);
        this.loadCustomer(id);
        this.snackbar.success(this.translate.instant('customers.saved'));
      },
      error: () => {
        this.saving.set(false);
      },
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

  protected tabLabel(tab: CustomerTab): string {
    const labels: Record<CustomerTab, string> = {
      overview: 'Overview',
      contacts: 'Contacts',
      interactions: 'Interactions',
      addresses: 'Addresses',
      estimates: 'Estimates',
      quotes: 'Quotes',
      orders: 'Orders',
      jobs: 'Jobs',
      invoices: 'Invoices',
      activity: 'Activity',
    };
    return labels[tab];
  }
}
