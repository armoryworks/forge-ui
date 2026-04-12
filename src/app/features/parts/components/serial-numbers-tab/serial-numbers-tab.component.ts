import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SerialService } from '../../services/serial.service';
import { SerialNumber, SerialNumberStatus, SerialHistory, SerialGenealogy } from '../../models/serial-number.model';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-serial-numbers-tab',
  standalone: true,
  imports: [
    DatePipe, NgTemplateOutlet, ReactiveFormsModule,
    DataTableComponent, DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    EmptyStateComponent, LoadingBlockDirective, ValidationPopoverDirective, ColumnCellDirective,
  ],
  templateUrl: './serial-numbers-tab.component.html',
  styleUrl: './serial-numbers-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SerialNumbersTabComponent {
  private readonly serialService = inject(SerialService);
  private readonly snackbar = inject(SnackbarService);

  readonly partId = input.required<number>();

  protected readonly serials = signal<SerialNumber[]>([]);
  protected readonly loading = signal(false);
  protected readonly showCreateDialog = signal(false);
  protected readonly saving = signal(false);

  // Detail / history
  protected readonly selectedSerial = signal<SerialNumber | null>(null);
  protected readonly serialHistory = signal<SerialHistory[]>([]);
  protected readonly showDetailDialog = signal(false);
  protected readonly historyLoading = signal(false);

  // Genealogy
  protected readonly genealogy = signal<SerialGenealogy | null>(null);
  protected readonly showGenealogyDialog = signal(false);
  protected readonly genealogyLoading = signal(false);

  protected readonly createForm = new FormGroup({
    serialValue: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.createForm, {
    serialValue: 'Serial Number',
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'serialValue', header: 'Serial #', sortable: true, width: '140px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: [
        { value: 'Available', label: 'Available' },
        { value: 'InUse', label: 'In Use' },
        { value: 'Shipped', label: 'Shipped' },
        { value: 'Returned', label: 'Returned' },
        { value: 'Scrapped', label: 'Scrapped' },
        { value: 'Quarantined', label: 'Quarantined' },
      ] },
    { field: 'currentLocationName', header: 'Location', sortable: true },
    { field: 'jobNumber', header: 'Job', sortable: true, width: '100px' },
    { field: 'manufacturedAt', header: 'Manufactured', sortable: true, type: 'date', width: '110px' },
    { field: 'childCount', header: 'Children', sortable: true, type: 'number', width: '80px' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: '-- All --' },
    { value: 'Available', label: 'Available' },
    { value: 'InUse', label: 'In Use' },
    { value: 'Shipped', label: 'Shipped' },
    { value: 'Returned', label: 'Returned' },
    { value: 'Scrapped', label: 'Scrapped' },
    { value: 'Quarantined', label: 'Quarantined' },
  ];

  protected readonly statusFilter = new FormControl<SerialNumberStatus | null>(null);

  constructor() {
    effect(() => {
      const id = this.partId();
      if (id) this.loadSerials(id);
    });
  }

  private loadSerials(partId: number): void {
    this.loading.set(true);
    const status = this.statusFilter.value ?? undefined;
    this.serialService.getPartSerials(partId, status).subscribe({
      next: (serials) => {
        this.serials.set(serials);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected applyStatusFilter(): void {
    this.loadSerials(this.partId());
  }

  protected openCreate(): void {
    this.createForm.reset({ serialValue: '', notes: '' });
    this.showCreateDialog.set(true);
  }

  protected closeCreate(): void {
    this.showCreateDialog.set(false);
  }

  protected saveSerial(): void {
    if (this.createForm.invalid) return;
    this.saving.set(true);
    const f = this.createForm.getRawValue();
    this.serialService.createSerialNumber(this.partId(), {
      serialValue: f.serialValue!,
      notes: f.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCreate();
        this.loadSerials(this.partId());
        this.snackbar.success('Serial number created');
      },
      error: () => this.saving.set(false),
    });
  }

  protected openDetail(serial: SerialNumber): void {
    this.selectedSerial.set(serial);
    this.showDetailDialog.set(true);
    this.historyLoading.set(true);
    this.serialService.getSerialHistory(serial.id).subscribe({
      next: (history) => {
        this.serialHistory.set(history);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  protected closeDetail(): void {
    this.showDetailDialog.set(false);
    this.selectedSerial.set(null);
    this.serialHistory.set([]);
  }

  protected openGenealogy(serial: SerialNumber): void {
    this.genealogyLoading.set(true);
    this.showGenealogyDialog.set(true);
    this.serialService.getGenealogy(serial.serialValue).subscribe({
      next: (tree) => {
        this.genealogy.set(tree);
        this.genealogyLoading.set(false);
      },
      error: () => this.genealogyLoading.set(false),
    });
  }

  protected closeGenealogy(): void {
    this.showGenealogyDialog.set(false);
    this.genealogy.set(null);
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Available': return 'chip chip--success';
      case 'InUse': return 'chip chip--primary';
      case 'Shipped': return 'chip chip--info';
      case 'Returned': return 'chip chip--warning';
      case 'Scrapped': return 'chip chip--error';
      case 'Quarantined': return 'chip chip--muted';
      default: return 'chip';
    }
  }
}
