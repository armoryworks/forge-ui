import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { NcrCapaService } from '../services/ncr-capa.service';
import { CorrectiveAction } from '../models/corrective-action.model';
import { CapaStatus } from '../models/capa-status.model';
import { CapaType } from '../models/capa-type.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';

@Component({
  selector: 'app-capa-list',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule,
    DataTableComponent, ColumnCellDirective,
    SelectComponent, InputComponent, TextareaComponent, DatepickerComponent,
    DialogComponent, LoadingBlockDirective,
    ValidationPopoverDirective,
  ],
  templateUrl: './capa-list.component.html',
  styleUrl: './capa-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapaListComponent implements OnInit {
  private readonly ncrCapaService = inject(NcrCapaService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly capas = signal<CorrectiveAction[]>([]);
  protected readonly showCreateDialog = signal(false);

  protected readonly statusFilter = new FormControl<CapaStatus | ''>('');
  protected readonly typeFilter = new FormControl<CapaType | ''>('');

  protected readonly typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'Corrective', label: 'Corrective' },
    { value: 'Preventive', label: 'Preventive' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Open', label: 'Open' },
    { value: 'RootCauseAnalysis', label: 'Root Cause Analysis' },
    { value: 'ActionPlanning', label: 'Action Planning' },
    { value: 'Implementation', label: 'Implementation' },
    { value: 'Verification', label: 'Verification' },
    { value: 'EffectivenessCheck', label: 'Effectiveness Check' },
    { value: 'Closed', label: 'Closed' },
  ];

  protected readonly sourceTypeOptions: SelectOption[] = [
    { value: 'Ncr', label: 'NCR' },
    { value: 'CustomerComplaint', label: 'Customer Complaint' },
    { value: 'InternalAudit', label: 'Internal Audit' },
    { value: 'ExternalAudit', label: 'External Audit' },
    { value: 'SpcOoc', label: 'SPC Out of Control' },
    { value: 'ManagementReview', label: 'Management Review' },
    { value: 'Other', label: 'Other' },
  ];

  protected readonly priorityOptions: SelectOption[] = [
    { value: 1, label: '1 — Critical' },
    { value: 2, label: '2 — High' },
    { value: 3, label: '3 — Medium' },
    { value: 4, label: '4 — Low' },
    { value: 5, label: '5 — Informational' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'capaNumber', header: 'CAPA #', sortable: true, width: '140px' },
    { field: 'type', header: 'Type', sortable: true, width: '100px' },
    { field: 'title', header: 'Title', sortable: true },
    { field: 'ownerName', header: 'Owner', sortable: true, width: '150px' },
    { field: 'priority', header: 'Priority', sortable: true, width: '80px', align: 'center' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', filterOptions: this.statusOptions.slice(1), width: '150px' },
    { field: 'dueDate', header: 'Due', sortable: true, type: 'date', width: '100px' },
    { field: 'tasks', header: 'Tasks', width: '80px', align: 'center' },
    { field: 'actions', header: '', width: '60px' },
  ];

  protected readonly createForm = new FormGroup({
    type: new FormControl<CapaType>('Corrective', { nonNullable: true }),
    sourceType: new FormControl('Other', { nonNullable: true }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    problemDescription: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    impactDescription: new FormControl(''),
    ownerId: new FormControl<number | null>(null, [Validators.required]),
    priority: new FormControl(3, { nonNullable: true }),
    dueDate: new FormControl<string | null>(null, [Validators.required]),
  });

  protected readonly createViolations = FormValidationService.getViolations(this.createForm, {
    title: 'Title',
    problemDescription: 'Problem Description',
    ownerId: 'Owner ID',
    dueDate: 'Due Date',
  });

  ngOnInit(): void {
    this.loadCapas();
  }

  loadCapas(): void {
    this.loading.set(true);
    const status = this.statusFilter.value || undefined;
    const type = this.typeFilter.value || undefined;
    this.ncrCapaService.getCapas({ status: status as CapaStatus, type: type as CapaType }).subscribe({
      next: capas => {
        this.capas.set(capas);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.createForm.reset({ type: 'Corrective', sourceType: 'Other', priority: 3 });
    this.showCreateDialog.set(true);
  }

  saveCapa(): void {
    if (this.createForm.invalid) return;
    this.saving.set(true);
    this.ncrCapaService.createCapa(this.createForm.getRawValue() as Partial<CorrectiveAction>).subscribe({
      next: () => {
        this.snackbar.success('CAPA created');
        this.showCreateDialog.set(false);
        this.saving.set(false);
        this.loadCapas();
      },
      error: () => this.saving.set(false),
    });
  }

  advancePhase(capa: CorrectiveAction): void {
    this.ncrCapaService.advanceCapaPhase(capa.id).subscribe({
      next: updated => {
        this.snackbar.success(`CAPA advanced to ${updated.status}`);
        this.loadCapas();
      },
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Open': return 'chip chip--error';
      case 'RootCauseAnalysis': return 'chip chip--warning';
      case 'ActionPlanning': return 'chip chip--info';
      case 'Implementation': return 'chip chip--primary';
      case 'Verification': return 'chip chip--warning';
      case 'EffectivenessCheck': return 'chip chip--info';
      case 'Closed': return 'chip chip--success';
      default: return 'chip';
    }
  }

  getPriorityClass(priority: number): string {
    if (priority <= 2) return 'chip chip--error';
    if (priority === 3) return 'chip chip--warning';
    return 'chip chip--muted';
  }
}
