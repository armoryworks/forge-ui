import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { VendorAddress } from '../../models/vendor-address.model';
import { VendorService } from '../../services/vendor.service';
import { VENDOR_ADDRESS_TYPES, VendorAddressDialogComponent } from '../vendor-address-dialog/vendor-address-dialog.component';

@Component({
  selector: 'app-vendor-addresses-tab',
  standalone: true,
  imports: [
    MatTooltipModule, TranslatePipe,
    EmptyStateComponent, LoadingBlockDirective,
    VendorAddressDialogComponent,
  ],
  templateUrl: './vendor-addresses-tab.component.html',
  styleUrl: '../vendor-contacts-tab/vendor-contacts-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorAddressesTabComponent implements OnInit {
  private readonly vendorService = inject(VendorService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vendorId = input.required<number>();

  protected readonly addresses = signal<VendorAddress[]>([]);
  protected readonly loading = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingAddress = signal<VendorAddress | null>(null);

  protected readonly canManage = computed(() => this.auth.hasAnyRole(['Admin', 'Manager', 'OfficeManager']));

  ngOnInit(): void {
    this.loadAddresses();
  }

  protected loadAddresses(): void {
    this.loading.set(true);
    this.vendorService.getAddresses(this.vendorId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.addresses.set([...list].sort((a, b) =>
            this.typeRank(a.addressType) - this.typeRank(b.addressType)
            || Number(b.isDefault) - Number(a.isDefault)
            || (a.label ?? '').localeCompare(b.label ?? '')));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected typeLabelKey(addressType: string): string {
    return VENDOR_ADDRESS_TYPES.find(t => t.value === addressType)?.labelKey ?? 'vendorContacts.addressTypes.other';
  }

  protected oneLine(a: VendorAddress): string {
    const cityLine = [a.city, [a.state, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(', ');
  }

  protected openAdd(): void {
    this.editingAddress.set(null);
    this.showDialog.set(true);
  }

  protected openEdit(address: VendorAddress): void {
    this.editingAddress.set(address);
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingAddress.set(null);
  }

  protected onSaved(): void {
    this.closeDialog();
    this.loadAddresses();
  }

  protected deleteAddress(address: VendorAddress): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('vendorContacts.deleteAddressTitle'),
        message: this.translate.instant('vendorContacts.deleteAddressMessage', { address: this.oneLine(address) }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.vendorService.deleteAddress(this.vendorId(), address.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('vendorContacts.addressDeleted'));
          this.loadAddresses();
        },
      });
    });
  }

  private typeRank(addressType: string): number {
    const index = VENDOR_ADDRESS_TYPES.findIndex(t => t.value === addressType);
    return index < 0 ? VENDOR_ADDRESS_TYPES.length : index;
  }
}
