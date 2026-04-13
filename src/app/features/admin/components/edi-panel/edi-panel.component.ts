import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
    DatePipe, ReactiveFormsModule, TranslatePipe,
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
  private readonly translate = inject(TranslateService);

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
    { value: 'X12', label: this.translate.instant('adminPanels.edi.formats.x12') },
    { value: 'Edifact', label: this.translate.instant('adminPanels.edi.formats.edifact') },
  ];

  protected readonly transportOptions: SelectOption[] = [
    { value: 'As2', label: this.translate.instant('adminPanels.edi.transports.as2') },
    { value: 'Sftp', label: this.translate.instant('adminPanels.edi.transports.sftp') },
    { value: 'Van', label: this.translate.instant('adminPanels.edi.transports.van') },
    { value: 'Email', label: this.translate.instant('adminPanels.edi.transports.email') },
    { value: 'Api', label: this.translate.instant('adminPanels.edi.transports.api') },
    { value: 'Manual', label: this.translate.instant('adminPanels.edi.transports.manual') },
  ];

  protected readonly directionOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('adminPanels.edi.directions.all') },
    { value: 'Inbound', label: this.translate.instant('adminPanels.edi.directions.inbound') },
    { value: 'Outbound', label: this.translate.instant('adminPanels.edi.directions.outbound') },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('adminPanels.edi.statuses.all') },
    { value: 'Received', label: this.translate.instant('adminPanels.edi.statuses.received') },
    { value: 'Parsing', label: this.translate.instant('adminPanels.edi.statuses.parsing') },
    { value: 'Parsed', label: this.translate.instant('adminPanels.edi.statuses.parsed') },
    { value: 'Processing', label: this.translate.instant('adminPanels.edi.statuses.processing') },
    { value: 'Applied', label: this.translate.instant('adminPanels.edi.statuses.applied') },
    { value: 'Error', label: this.translate.instant('adminPanels.edi.statuses.error') },
    { value: 'Acknowledged', label: this.translate.instant('adminPanels.edi.statuses.acknowledged') },
    { value: 'Rejected', label: this.translate.instant('adminPanels.edi.statuses.rejected') },
  ];

  protected readonly partnerColumns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('adminPanels.edi.cols.name'), sortable: true },
    { field: 'customerName', header: this.translate.instant('adminPanels.edi.cols.customer'), sortable: true, width: '150px' },
    { field: 'vendorName', header: this.translate.instant('adminPanels.edi.cols.vendor'), sortable: true, width: '150px' },
    { field: 'defaultFormat', header: this.translate.instant('adminPanels.edi.cols.format'), sortable: true, width: '90px' },
    { field: 'transportMethod', header: this.translate.instant('adminPanels.edi.cols.transport'), sortable: true, width: '100px' },
    { field: 'transactionCount', header: this.translate.instant('adminPanels.edi.cols.txns'), sortable: true, width: '70px', align: 'right' },
    { field: 'errorCount', header: this.translate.instant('adminPanels.edi.cols.errors'), sortable: true, width: '70px', align: 'right' },
    { field: 'isActive', header: this.translate.instant('adminPanels.edi.cols.active'), width: '70px', align: 'center' },
    { field: 'actions', header: '', width: '100px' },
  ];

  protected readonly transactionColumns: ColumnDef[] = [
    { field: 'tradingPartnerName', header: this.translate.instant('adminPanels.edi.cols.partner'), sortable: true, width: '150px' },
    { field: 'direction', header: this.translate.instant('adminPanels.edi.cols.dir'), sortable: true, filterable: true, type: 'enum', filterOptions: this.directionOptions.slice(1), width: '90px' },
    { field: 'transactionSet', header: this.translate.instant('adminPanels.edi.cols.set'), sortable: true, width: '60px', align: 'center' },
    { field: 'controlNumber', header: this.translate.instant('adminPanels.edi.cols.controlNumber'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('adminPanels.edi.cols.status'), sortable: true, filterable: true, type: 'enum', filterOptions: this.statusOptions.slice(1), width: '110px' },
    { field: 'relatedEntityType', header: this.translate.instant('adminPanels.edi.cols.entity'), sortable: true, width: '100px' },
    { field: 'receivedAt', header: this.translate.instant('adminPanels.edi.cols.received'), sortable: true, type: 'date', width: '110px' },
    { field: 'retryCount', header: this.translate.instant('adminPanels.edi.cols.retries'), sortable: true, width: '70px', align: 'right' },
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
        this.snackbar.success(editing ? this.translate.instant('adminPanels.edi.snackbar.partnerUpdated') : this.translate.instant('adminPanels.edi.snackbar.partnerCreated'));
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
        this.snackbar.success(this.translate.instant('adminPanels.edi.snackbar.partnerDeleted'));
        this.loadPartners();
      },
    });
  }

  protected testConnection(partner: EdiTradingPartner): void {
    this.ediService.testConnection(partner.id).subscribe({
      next: result => {
        if (result.success) this.snackbar.success(this.translate.instant('adminPanels.edi.snackbar.connectionSuccess'));
        else this.snackbar.error(this.translate.instant('adminPanels.edi.snackbar.connectionFailed') + ' ' + result.message);
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
        this.snackbar.success(this.translate.instant('adminPanels.edi.snackbar.retryQueued'));
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
