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

import { VendorContact } from '../../models/vendor-contact.model';
import { VendorService } from '../../services/vendor.service';
import { VendorContactDialogComponent } from '../vendor-contact-dialog/vendor-contact-dialog.component';

@Component({
  selector: 'app-vendor-contacts-tab',
  standalone: true,
  imports: [
    MatTooltipModule, TranslatePipe,
    EmptyStateComponent, LoadingBlockDirective,
    VendorContactDialogComponent,
  ],
  templateUrl: './vendor-contacts-tab.component.html',
  styleUrl: './vendor-contacts-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorContactsTabComponent implements OnInit {
  private readonly vendorService = inject(VendorService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vendorId = input.required<number>();

  protected readonly contacts = signal<VendorContact[]>([]);
  protected readonly loading = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingContact = signal<VendorContact | null>(null);

  protected readonly canManage = computed(() => this.auth.hasAnyRole(['Admin', 'Manager', 'OfficeManager']));

  ngOnInit(): void {
    this.loadContacts();
  }

  protected loadContacts(): void {
    this.loading.set(true);
    this.vendorService.getContacts(this.vendorId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.contacts.set([...list].sort((a, b) =>
            Number(b.isPrimary) - Number(a.isPrimary)
            || a.lastName.localeCompare(b.lastName)
            || a.firstName.localeCompare(b.firstName)));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected openAdd(): void {
    this.editingContact.set(null);
    this.showDialog.set(true);
  }

  protected openEdit(contact: VendorContact): void {
    this.editingContact.set(contact);
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingContact.set(null);
  }

  protected onSaved(): void {
    this.closeDialog();
    this.loadContacts();
  }

  protected deleteContact(contact: VendorContact): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('vendorContacts.deleteContactTitle'),
        message: this.translate.instant('vendorContacts.deleteContactMessage', {
          name: `${contact.firstName} ${contact.lastName}`,
        }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.vendorService.deleteContact(this.vendorId(), contact.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('vendorContacts.contactDeleted'));
          this.loadContacts();
        },
      });
    });
  }
}
