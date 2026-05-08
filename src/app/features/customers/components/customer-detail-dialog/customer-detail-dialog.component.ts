import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { CustomerService } from '../../services/customer.service';
import { CustomerSummary } from '../../models/customer-summary.model';
import { CustomerOverviewTabComponent } from '../../pages/customer-detail/tabs/customer-overview-tab.component';
import { CustomerIdentityClusterComponent } from '../customer-clusters/customer-identity-cluster.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TranslateService } from '@ngx-translate/core';

export interface CustomerDetailDialogData {
  customerId: number;
}

export interface CustomerDetailDialogResult {
  /** Set when the user clicked "Open Customer Page". The caller navigates. */
  openedFullPage?: boolean;
}

/**
 * Wave 5+ — Lightweight customer preview dialog. Opens from cross-entity
 * links (`<app-entity-link type="customer">`) and the `?detail=customer:{id}`
 * URL pattern. Renders the same content as the customer-detail Overview
 * tab — identity cluster + account details + credit-status card (gated by
 * CAP-O2C-CREDIT-LIMITS) — without the 9-tab shell, so the user can peek
 * at a customer from invoice / sales-order / shipment context without
 * losing their place.
 *
 * For the full multi-tab detail (Contacts / Estimates / Quotes / Orders /
 * etc.), the footer's "Open customer page" button navigates to
 * `/customers/:id/overview`. The user opts into leaving the originating
 * page; the cross-entity link no longer yanks them away unconditionally.
 */
@Component({
  selector: 'app-customer-detail-dialog',
  standalone: true,
  imports: [
    TranslatePipe,
    DialogComponent, LoadingBlockDirective,
    CustomerIdentityClusterComponent, CustomerOverviewTabComponent,
  ],
  templateUrl: './customer-detail-dialog.component.html',
  styleUrl: './customer-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CustomerDetailDialogComponent, CustomerDetailDialogResult | undefined>);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<CustomerDetailDialogData>(MAT_DIALOG_DATA);

  protected readonly customer = signal<CustomerSummary | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const id = this.data.customerId;
      if (id > 0) this.loadCustomer(id);
    });
  }

  private loadCustomer(id: number): void {
    this.loading.set(true);
    this.customerService.getCustomerSummary(id).subscribe({
      next: c => { this.customer.set(c); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.snackbar.error(this.translate.instant('customers.previewDialog.loadFailed'));
        this.dialogRef.close(undefined);
      },
    });
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected openFullPage(): void {
    const id = this.customer()?.id ?? this.data.customerId;
    this.dialogRef.close({ openedFullPage: true });
    this.router.navigate(['/customers', id, 'overview']);
  }
}
