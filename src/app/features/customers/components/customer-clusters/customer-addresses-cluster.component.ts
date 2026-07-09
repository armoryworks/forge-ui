import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';

import { CustomerAddressService } from '../../services/customer-address.service';
import { CustomerAddressDialogComponent } from './customer-address-dialog.component';

/**
 * Wave 6 — Customer Addresses cluster.
 *
 * Address list + full CRUD (add/edit dialog, delete with confirm) against
 * CustomerAddressesController via CustomerAddressService. Mounted into the
 * Addresses tab on the customer detail page.
 *
 * Was previously `CustomerAddressesTabComponent` at
 * `pages/customer-detail/tabs/`. Moved to `components/customer-clusters/`
 * + renamed to match the cluster naming convention.
 *
 * Gated server-side and in the parent layout by CAP-MD-CUSTOMER-ADDRESSES;
 * the customer-create flow writes a single primary address directly via
 * CreateCustomerCommand, bypassing this cluster entirely for single-
 * address shops.
 */
@Component({
  selector: 'app-customer-addresses-cluster',
  standalone: true,
  imports: [TranslatePipe, MatTooltipModule, CustomerAddressDialogComponent],
  templateUrl: './customer-addresses-cluster.component.html',
  styleUrl: '../../pages/customer-detail/customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressesClusterComponent implements OnInit {
  private readonly addressService = inject(CustomerAddressService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  readonly customerId = input.required<number>();

  protected readonly addresses = signal<CustomerAddress[]>([]);
  protected readonly loading = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingAddress = signal<CustomerAddress | null>(null);

  // F3 — address history. Only admins may see inactive addresses or toggle active state
  // (the server also enforces both: includeInactive honored for Admin, PATCH /active is Admin-only).
  protected readonly isAdmin = this.auth.hasRole('Admin');
  protected readonly showInactive = signal(false);

  ngOnInit(): void {
    this.loadAddresses();
  }

  private loadAddresses(): void {
    this.loading.set(true);
    this.addressService.getAddresses(this.customerId(), this.showInactive() && this.isAdmin).subscribe({
      next: data => { this.addresses.set(data); this.loading.set(false); },
      error: () => { this.addresses.set([]); this.loading.set(false); },
    });
  }

  protected toggleShowInactive(): void {
    this.showInactive.update(v => !v);
    this.loadAddresses();
  }

  protected setActive(address: CustomerAddress, isActive: boolean): void {
    const proceed = () => this.addressService.setAddressActive(this.customerId(), address.id, isActive).subscribe({
      next: () => {
        this.loadAddresses();
        this.snackbar.success(this.translate.instant(
          isActive ? 'customers.addresses.addressReactivated' : 'customers.addresses.addressDeactivated'));
      },
    });

    if (isActive) { proceed(); return; }
    // Deactivating retires the address from pickers — confirm first.
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.addresses.deactivateTitle'),
        message: this.translate.instant('customers.addresses.deactivateMessage', { label: address.label }),
        confirmLabel: this.translate.instant('customers.addresses.deactivate'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => { if (confirmed) proceed(); });
  }

  protected openAdd(): void {
    this.editingAddress.set(null);
    this.showDialog.set(true);
  }

  protected openEdit(address: CustomerAddress): void {
    this.editingAddress.set(address);
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingAddress.set(null);
  }

  protected onDialogSaved(): void {
    this.closeDialog();
    this.loadAddresses();
  }

  protected deleteAddress(address: CustomerAddress): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.addresses.deleteAddressTitle'),
        message: this.translate.instant('customers.addresses.deleteAddressMessage', { label: address.label }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.addressService.deleteAddress(this.customerId(), address.id).subscribe({
        next: () => {
          this.loadAddresses();
          this.snackbar.success(this.translate.instant('customers.addresses.addressDeleted'));
        },
      });
    });
  }
}
