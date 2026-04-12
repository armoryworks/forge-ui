import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { SpcService } from '../services/spc.service';
import { SpcOocEvent, SpcOocSeverity, SpcOocStatus } from '../models/spc.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-spc-ooc-list',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule,
    DataTableComponent, ColumnCellDirective,
    SelectComponent, DialogComponent, TextareaComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './spc-ooc-list.component.html',
  styleUrl: './spc-ooc-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpcOocListComponent {
  private readonly spcService = inject(SpcService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly events = signal<SpcOocEvent[]>([]);
  protected readonly showAckDialog = signal(false);
  protected readonly ackEvent = signal<SpcOocEvent | null>(null);
  protected readonly ackNotes = new FormControl('');

  protected readonly statusFilter = new FormControl<SpcOocStatus | ''>('');
  protected readonly severityFilter = new FormControl<SpcOocSeverity | ''>('');

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Open', label: 'Open' },
    { value: 'Acknowledged', label: 'Acknowledged' },
    { value: 'CapaCreated', label: 'CAPA Created' },
    { value: 'Resolved', label: 'Resolved' },
  ];

  protected readonly severityOptions: SelectOption[] = [
    { value: '', label: 'All Severities' },
    { value: 'Warning', label: 'Warning' },
    { value: 'OutOfControl', label: 'Out of Control' },
    { value: 'OutOfSpec', label: 'Out of Spec' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'detectedAt', header: 'Detected', sortable: true, type: 'date', width: '130px' },
    { field: 'partNumber', header: 'Part', sortable: true, width: '100px' },
    { field: 'characteristicName', header: 'Characteristic', sortable: true },
    { field: 'ruleName', header: 'Rule', sortable: true, width: '200px' },
    { field: 'severity', header: 'Severity', sortable: true, width: '110px', filterable: true, type: 'enum',
      filterOptions: [
        { value: 'Warning', label: 'Warning' },
        { value: 'OutOfControl', label: 'Out of Control' },
        { value: 'OutOfSpec', label: 'Out of Spec' },
      ]},
    { field: 'status', header: 'Status', sortable: true, width: '120px', filterable: true, type: 'enum',
      filterOptions: [
        { value: 'Open', label: 'Open' },
        { value: 'Acknowledged', label: 'Acknowledged' },
        { value: 'CapaCreated', label: 'CAPA Created' },
        { value: 'Resolved', label: 'Resolved' },
      ]},
    { field: 'acknowledgedByName', header: 'Acknowledged By', sortable: true, width: '140px' },
    { field: 'actions', header: '', width: '80px', align: 'center' },
  ];

  constructor() {
    this.loadEvents();
  }

  protected loadEvents(): void {
    this.loading.set(true);
    const status = this.statusFilter.value || undefined;
    const severity = this.severityFilter.value || undefined;
    this.spcService.getOocEvents({ status: status as SpcOocStatus, severity: severity as SpcOocSeverity }).subscribe({
      next: data => { this.events.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void {
    this.loadEvents();
  }

  protected openAcknowledge(event: SpcOocEvent): void {
    this.ackEvent.set(event);
    this.ackNotes.reset();
    this.showAckDialog.set(true);
  }

  protected closeAckDialog(): void {
    this.showAckDialog.set(false);
    this.ackEvent.set(null);
  }

  protected acknowledge(): void {
    const evt = this.ackEvent();
    if (!evt) return;
    this.saving.set(true);
    this.spcService.acknowledgeOoc(evt.id, this.ackNotes.value?.trim() || undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAckDialog();
        this.loadEvents();
        this.snackbar.success('OOC event acknowledged');
      },
      error: () => this.saving.set(false),
    });
  }

  protected createCapa(event: SpcOocEvent): void {
    this.spcService.createCapaFromOoc(event.id).subscribe({
      next: () => {
        this.loadEvents();
        this.snackbar.success('CAPA created from OOC event');
      },
    });
  }

  protected getSeverityClass(severity: string): string {
    const map: Record<string, string> = {
      Warning: 'chip--warning',
      OutOfControl: 'chip--error',
      OutOfSpec: 'chip--error',
    };
    return `chip ${map[severity] ?? ''}`.trim();
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Open: 'chip--error',
      Acknowledged: 'chip--warning',
      CapaCreated: 'chip--info',
      Resolved: 'chip--success',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }
}
