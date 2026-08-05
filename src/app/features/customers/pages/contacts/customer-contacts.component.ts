import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { CustomerService } from '../../services/customer.service';
import { FlatContactRow } from '../../models/flat-contact.model';
import { CustomerContactDialogComponent } from '../../components/customer-clusters/customer-contact-dialog.component';

@Component({
  selector: 'app-customer-contacts-page',
  standalone: true,
  imports: [
    TranslatePipe,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
    CustomerContactDialogComponent,
  ],
  templateUrl: './customer-contacts.component.html',
  styleUrl: './customer-contacts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerContactsPageComponent implements OnInit {
  private readonly service = inject(CustomerService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly capabilityService = inject(CapabilityService);

  protected readonly displayRows = signal<(FlatContactRow & { fullName: string })[]>([]);
  protected readonly loading = signal(true);
  protected readonly showAddDialog = signal(false);

  /**
   * Gates the "Add Contact" affordance on the same capability that gates the
   * per-customer Contacts tab + Contact CRUD endpoints. `defaultWhenUnknown`
   * is true because CAP-MD-CUSTOMER-CONTACTS is default-on in the server
   * catalog — with no capability snapshot available the button fails open
   * rather than silently vanishing (rows themselves stay read-only either
   * way; the server still 403s if the capability is genuinely off).
   */
  protected readonly canAddContact = computed(() =>
    this.capabilityService.isEnabled('CAP-MD-CUSTOMER-CONTACTS', true));

  protected readonly columns: ColumnDef[] = [
    { field: 'fullName', header: this.translate.instant('customers.contactName'), sortable: true },
    { field: 'customerName', header: this.translate.instant('customers.title'), sortable: true },
    { field: 'role', header: this.translate.instant('customers.role'), sortable: true, width: '120px' },
    { field: 'email', header: this.translate.instant('common.email'), sortable: true },
    { field: 'phone', header: this.translate.instant('common.phone'), sortable: true, width: '140px' },
    { field: 'suppression', header: this.translate.instant('leads.suppression.colChannels'), width: '180px' },
    { field: 'isPrimary', header: this.translate.instant('customers.primary'), sortable: true, width: '80px' },
  ];

  ngOnInit(): void {
    this.loadContacts();
  }

  private loadContacts(): void {
    this.loading.set(true);
    this.service.getAllContactsFlat().subscribe({
      next: (data) => {
        this.displayRows.set(data.map(r => ({ ...r, fullName: `${r.lastName}, ${r.firstName}` })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Row click deep-links to the customer's Contacts tab, where full CRUD lives. */
  protected openCustomer(row: FlatContactRow): void {
    this.router.navigate(['/customers', row.customerId, 'contacts']);
  }

  protected openAdd(): void {
    this.showAddDialog.set(true);
  }

  protected closeAdd(): void {
    this.showAddDialog.set(false);
  }

  protected onContactSaved(): void {
    this.closeAdd();
    this.loadContacts();
  }
}
