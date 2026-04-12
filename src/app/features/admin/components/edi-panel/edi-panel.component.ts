import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { EdiService } from '../../services/edi.service';
import { EdiTradingPartner } from '../../models/edi-trading-partner.model';
import { EdiTransaction } from '../../models/edi-transaction.model';
import { EdiTransactionDetail } from '../../models/edi-transaction-detail.model';
import { EdiFormat } from '../../models/edi-format.model';
import { EdiTransportMethod } from '../../models/edi-transport-method.model';
import { EdiDirection } from '../../models/edi-direction.model';
import { EdiTransactionStatus } from '../../models/edi-transaction-status.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';

@Component({
  selector: 'app-edi-panel',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule,
    DataTableComponent, ColumnCellDirective,
    SelectComponent, InputComponent, TextareaComponent, ToggleComponent,
    DialogComponent, LoadingBlockDirective, ValidationPopoverDirective,
  ],
  templateUrl: './edi-panel.component.html',
  styleUrl: './edi-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdiPanelComponent {
  private readonly ediService = inject(EdiService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly partners = signal<EdiTradingPartner[]>([]);
  protected readonly transactions = signal<EdiTransaction[]>([]);
  protected readonly selectedTransaction = signal<EdiTransactionDetail | null>(null);

  protected readonly subTab = signal<'partners' | 'transactions'>('partners');
  protected readonly showPartnerDialog = signal(false);
  protected readonly showTransactionDetail = signal(false);
  protected readonly editingPartner = signal<EdiTradingPartner | null>(null);

  protected readonly statusFilter = new FormControl<EdiTransactionStatus | ''>('');
  protected readonly directionFilter = new FormControl<EdiDirection | ''>('');

  protected readonly formatOptions: SelectOption[] = [
    { value: 'X12', label: 'X12 (ANSI)' },
    { value: 'Edifact', label: 'EDIFACT (UN)' },
  ];

  protected readonly transportOptions: SelectOption[] = [
    { value: 'As2', label: 'AS2' },
    { value: 'Sftp', label: 'SFTP' },
    { value: 'Van', label: 'VAN' },
    { value: 'Email', label: 'Email' },
    { value: 'Api', label: 'API' },
    { value: 'Manual', label: 'Manual' },
  ];

  protected readonly directionOptions: SelectOption[] = [
    { value: '', label: 'All Directions' },
    { value: 'Inbound', label: 'Inbound' },
    { value: 'Outbound', label: 'Outbound' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Received', label: 'Received' },
    { value: 'Parsing', label: 'Parsing' },
    { value: 'Parsed', label: 'Parsed' },
    { value: 'Processing', label: 'Processing' },
    { value: 'Applied', label: 'Applied' },
    { value: 'Error', label: 'Error' },
    { value: 'Acknowledged', label: 'Acknowledged' },
    { value: 'Rejected', label: 'Rejected' },
  ];

  protected readonly partnerColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'customerName', header: 'Customer', sortable: true, width: '150px' },
    { field: 'vendorName', header: 'Vendor', sortable: true, width: '150px' },
    { field: 'defaultFormat', header: 'Format', sortable: true, width: '90px' },
    { field: 'transportMethod', header: 'Transport', sortable: true, width: '100px' },
    { field: 'transactionCount', header: 'Txns', sortable: true, width: '70px', align: 'right' },
    { field: 'errorCount', header: 'Errors', sortable: true, width: '70px', align: 'right' },
    { field: 'isActive', header: 'Active', width: '70px', align: 'center' },
    { field: 'actions', header: '', width: '100px' },
  ];

  protected readonly transactionColumns: ColumnDef[] = [
    { field: 'tradingPartnerName', header: 'Partner', sortable: true, width: '150px' },
    { field: 'direction', header: 'Dir', sortable: true, filterable: true, type: 'enum', filterOptions: this.directionOptions.slice(1), width: '90px' },
    { field: 'transactionSet', header: 'Set', sortable: true, width: '60px', align: 'center' },
    { field: 'controlNumber', header: 'Control #', sortable: true, width: '120px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', filterOptions: this.statusOptions.slice(1), width: '110px' },
    { field: 'relatedEntityType', header: 'Entity', sortable: true, width: '100px' },
    { field: 'receivedAt', header: 'Received', sortable: true, type: 'date', width: '110px' },
    { field: 'retryCount', header: 'Retries', sortable: true, width: '70px', align: 'right' },
    { field: 'actions', header: '', width: '80px' },
  ];

  protected readonly partnerForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    qualifierId: new FormControl('ZZ', { nonNullable: true, validators: [Validators.required, Validators.maxLength(10)] }),
    qualifierValue: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    defaultFormat: new FormControl<EdiFormat>('X12', { nonNullable: true }),
    transportMethod: new FormControl<EdiTransportMethod>('Manual', { nonNullable: true }),
    autoProcess: new FormControl(true, { nonNullable: true }),
    requireAcknowledgment: new FormControl(true, { nonNullable: true }),
    notes: new FormControl(''),
  });

  protected readonly partnerViolations = FormValidationService.getViolations(this.partnerForm, {
    name: 'Name',
    qualifierId: 'Qualifier ID',
    qualifierValue: 'Qualifier Value',
  });

  constructor() {
    this.loadPartners();
  }

  protected switchSubTab(tab: 'partners' | 'transactions'): void {
    this.subTab.set(tab);
    if (tab === 'partners') this.loadPartners();
    else this.loadTransactions();
  }

  protected loadPartners(): void {
    this.loading.set(true);
    this.ediService.getTradingPartners().subscribe({
      next: list => { this.partners.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected loadTransactions(): void {
    this.loading.set(true);
    const direction = this.directionFilter.value || undefined;
    const status = this.statusFilter.value || undefined;
    this.ediService.getTransactions({
      direction: direction as EdiDirection,
      status: status as EdiTransactionStatus,
    }).subscribe({
      next: res => { this.transactions.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openCreatePartner(): void {
    this.editingPartner.set(null);
    this.partnerForm.reset({ name: '', qualifierId: 'ZZ', qualifierValue: '', defaultFormat: 'X12', transportMethod: 'Manual', autoProcess: true, requireAcknowledgment: true });
    this.showPartnerDialog.set(true);
  }

  protected openEditPartner(partner: EdiTradingPartner): void {
    this.editingPartner.set(partner);
    this.partnerForm.patchValue({
      name: partner.name,
      qualifierId: partner.qualifierId,
      qualifierValue: partner.qualifierValue,
      defaultFormat: partner.defaultFormat,
      transportMethod: partner.transportMethod,
      autoProcess: partner.autoProcess,
      requireAcknowledgment: partner.requireAcknowledgment,
      notes: partner.notes,
    });
    this.showPartnerDialog.set(true);
  }

  protected savePartner(): void {
    if (this.partnerForm.invalid) return;
    this.saving.set(true);
    const val = this.partnerForm.getRawValue();
    const editing = this.editingPartner();

    const obs = editing
      ? this.ediService.updateTradingPartner(editing.id, val)
      : this.ediService.createTradingPartner(val);

    obs.subscribe({
      next: () => {
        this.snackbar.success(editing ? 'Partner updated' : 'Partner created');
        this.showPartnerDialog.set(false);
        this.saving.set(false);
        this.loadPartners();
      },
      error: () => this.saving.set(false),
    });
  }

  protected deletePartner(partner: EdiTradingPartner): void {
    this.ediService.deleteTradingPartner(partner.id).subscribe({
      next: () => {
        this.snackbar.success('Partner deleted');
        this.loadPartners();
      },
    });
  }

  protected testConnection(partner: EdiTradingPartner): void {
    this.ediService.testConnection(partner.id).subscribe({
      next: result => {
        if (result.success) this.snackbar.success('Connection successful');
        else this.snackbar.error(`Connection failed: ${result.message}`);
      },
    });
  }

  protected viewTransaction(txn: EdiTransaction): void {
    this.ediService.getTransaction(txn.id).subscribe({
      next: detail => {
        this.selectedTransaction.set(detail);
        this.showTransactionDetail.set(true);
      },
    });
  }

  protected retryTransaction(txn: EdiTransaction): void {
    this.ediService.retryTransaction(txn.id).subscribe({
      next: () => {
        this.snackbar.success('Transaction queued for retry');
        this.loadTransactions();
      },
    });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Applied': return 'chip chip--success';
      case 'Error': return 'chip chip--error';
      case 'Rejected': return 'chip chip--error';
      case 'Received': return 'chip chip--info';
      case 'Parsing': case 'Processing': case 'Validating': return 'chip chip--warning';
      case 'Acknowledged': return 'chip chip--muted';
      default: return 'chip';
    }
  }

  protected getDirectionClass(direction: string): string {
    return direction === 'Inbound' ? 'chip chip--info' : 'chip chip--primary';
  }
}
