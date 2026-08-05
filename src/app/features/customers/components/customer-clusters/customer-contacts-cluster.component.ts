import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';

import { CustomerService } from '../../services/customer.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { Contact } from '../../models/contact.model';
import { CustomerContactDialogComponent } from './customer-contact-dialog.component';

/**
 * Wave 6 — Customer Contacts cluster.
 *
 * Multi-row entity collection cluster (mirrors VendorSourcesPanelComponent's
 * shape on Parts). Renders the contact list; mounted into the Contacts tab
 * on the customer detail page.
 *
 * The add/edit modal was extracted to `CustomerContactDialogComponent`
 * (sibling file, mirroring `CustomerAddressDialogComponent`) so the
 * top-level /customers/contacts page can reuse the exact same dialog with
 * a customer picker in front. The cluster binds `customerId`, which hides
 * the picker — the visible UX here is unchanged.
 *
 * The cluster is gated server-side by CAP-MD-CUSTOMER-CONTACTS;
 * customer-detail.component.ts drops the corresponding tab from the
 * layout when the capability is disabled (failing open to the catalog
 * default when no capability snapshot is available).
 */
@Component({
  selector: 'app-customer-contacts-cluster',
  standalone: true,
  imports: [
    TranslatePipe,
    AvatarComponent, CustomerContactDialogComponent,
  ],
  templateUrl: './customer-contacts-cluster.component.html',
  styleUrl: '../../pages/customer-detail/customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerContactsClusterComponent implements OnInit {
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  readonly customerId = input.required<number>();

  protected readonly contacts = signal<Contact[]>([]);
  protected readonly loading = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingContact = signal<Contact | null>(null);

  protected getInitials(c: Contact): string {
    return (c.firstName[0] ?? '') + (c.lastName[0] ?? '');
  }

  ngOnInit(): void {
    this.loadContacts();
  }

  private loadContacts(): void {
    this.loading.set(true);
    this.customerService.getCustomerById(this.customerId()).subscribe({
      next: detail => {
        this.contacts.set(detail.contacts ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openAdd(): void {
    this.editingContact.set(null);
    this.showDialog.set(true);
  }

  protected openEdit(contact: Contact): void {
    this.editingContact.set(contact);
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingContact.set(null);
  }

  protected onDialogSaved(): void {
    this.closeDialog();
    this.loadContacts();
  }

  protected deleteContact(contact: Contact): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.deleteContactTitle'),
        message: this.translate.instant('customers.deleteContactMessage', {
          name: `${contact.firstName} ${contact.lastName}`,
        }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.deleteContact(this.customerId(), contact.id).subscribe({
        next: () => {
          this.loadContacts();
          this.snackbar.success(this.translate.instant('customers.contactRemoved'));
        },
      });
    });
  }
}
