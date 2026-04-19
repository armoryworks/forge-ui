import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { ScanLogEntry } from '../../../../shared/models/scan-log.model';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../../shared/components/toolbar/toolbar.component';
import { toIsoDate } from '../../../../shared/utils/date.utils';

const ACTION_TYPE_OPTIONS: SelectOption[] = [
  { value: null, label: 'All' },
  { value: 'Move', label: 'Move' },
  { value: 'CycleCount', label: 'Count' },
  { value: 'Receive', label: 'Receive' },
  { value: 'Ship', label: 'Ship' },
  { value: 'Issue', label: 'Issue' },
];

@Component({
  selector: 'app-scan-daily-log',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    DataTableComponent,
    SelectComponent,
    DatepickerComponent,
    ColumnCellDirective,
    PageLayoutComponent,
    ToolbarComponent,
  ],
  templateUrl: './scan-daily-log.component.html',
  styleUrl: './scan-daily-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanDailyLogComponent implements OnInit {
  private readonly scanActionService = inject(ScanActionService);

  readonly closed = output<void>();

  readonly entries = signal<ScanLogEntry[]>([]);
  readonly loading = signal(false);

  readonly dateControl = new FormControl(new Date());
  readonly actionTypeControl = new FormControl<string | null>(null);
  readonly actionTypeOptions = ACTION_TYPE_OPTIONS;

  private readonly dateValue = toSignal(
    this.dateControl.valueChanges.pipe(startWith(this.dateControl.value)),
    { initialValue: this.dateControl.value },
  );

  private readonly actionTypeValue = toSignal(
    this.actionTypeControl.valueChanges.pipe(startWith(this.actionTypeControl.value)),
    { initialValue: this.actionTypeControl.value },
  );

  readonly columns: ColumnDef[] = [
    { field: 'createdAt', header: 'Time', sortable: true, type: 'date', width: '100px' },
    { field: 'actionType', header: 'Action', sortable: true, width: '100px' },
    { field: 'partNumber', header: 'Part', sortable: true, width: '120px' },
    { field: 'quantity', header: 'Qty', sortable: true, type: 'number', width: '70px', align: 'right' },
    { field: 'fromLocation', header: 'From', sortable: true, width: '120px' },
    { field: 'toLocation', header: 'To', sortable: true, width: '120px' },
    { field: 'relatedEntity', header: 'Related', sortable: true, width: '120px' },
    { field: 'status', header: 'Status', sortable: false, width: '100px' },
  ];

  // Summary stats
  readonly totalCount = computed(() => this.entries().length);
  readonly moveCount = computed(() => this.entries().filter(e => e.actionType === 'Move').length);
  readonly receiveCount = computed(() => this.entries().filter(e => e.actionType === 'Receive').length);
  readonly issueCount = computed(() => this.entries().filter(e => e.actionType === 'Issue').length);
  readonly countCount = computed(() => this.entries().filter(e => e.actionType === 'CycleCount').length);
  readonly shipCount = computed(() => this.entries().filter(e => e.actionType === 'Ship').length);

  readonly summaryText = computed(() => {
    const parts: string[] = [];
    if (this.moveCount() > 0) parts.push(`${this.moveCount()} moves`);
    if (this.receiveCount() > 0) parts.push(`${this.receiveCount()} receives`);
    if (this.issueCount() > 0) parts.push(`${this.issueCount()} issues`);
    if (this.countCount() > 0) parts.push(`${this.countCount()} counts`);
    if (this.shipCount() > 0) parts.push(`${this.shipCount()} ships`);
    return parts.join(', ');
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const date = this.dateValue();
    const dateStr = date ? toIsoDate(date)!.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const actionType = this.actionTypeValue() || undefined;

    this.scanActionService.getScanLog(undefined, dateStr, actionType).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onDateChange(): void {
    this.loadData();
  }

  onActionTypeChange(): void {
    this.loadData();
  }
}
