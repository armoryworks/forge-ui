import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
import { SCAN_LOG_ACTION_LABEL_KEYS } from '../../models/scan-log-action-label-keys.const';

const ACTION_TYPE_FILTER_VALUES = ['Move', 'CycleCount', 'Receive', 'Ship', 'Issue'];

@Component({
  selector: 'app-scan-daily-log',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
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
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();

  readonly entries = signal<ScanLogEntry[]>([]);
  readonly loading = signal(false);

  readonly dateControl = new FormControl(new Date());
  readonly actionTypeControl = new FormControl<string | null>(null);
  readonly actionTypeOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('kioskFlows.dailyLog.all') },
    ...ACTION_TYPE_FILTER_VALUES.map(value => ({ value, label: this.actionTypeLabel(value) })),
  ];

  private readonly dateValue = toSignal(
    this.dateControl.valueChanges.pipe(startWith(this.dateControl.value)),
    { initialValue: this.dateControl.value },
  );

  private readonly actionTypeValue = toSignal(
    this.actionTypeControl.valueChanges.pipe(startWith(this.actionTypeControl.value)),
    { initialValue: this.actionTypeControl.value },
  );

  readonly columns: ColumnDef[] = [
    { field: 'createdAt', header: this.translate.instant('kioskFlows.dailyLog.columns.time'), sortable: true, type: 'date', width: '100px' },
    { field: 'actionType', header: this.translate.instant('kioskFlows.dailyLog.columns.action'), sortable: true, width: '100px' },
    { field: 'partNumber', header: this.translate.instant('kioskFlows.dailyLog.columns.part'), sortable: true, width: '120px' },
    { field: 'quantity', header: this.translate.instant('kioskFlows.dailyLog.columns.qty'), sortable: true, type: 'number', width: '70px', align: 'right' },
    { field: 'fromLocation', header: this.translate.instant('kioskFlows.dailyLog.columns.from'), sortable: true, width: '120px' },
    { field: 'toLocation', header: this.translate.instant('kioskFlows.dailyLog.columns.to'), sortable: true, width: '120px' },
    { field: 'relatedEntity', header: this.translate.instant('kioskFlows.dailyLog.columns.related'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('kioskFlows.dailyLog.columns.status'), sortable: false, width: '100px' },
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
    if (this.moveCount() > 0) parts.push(this.translate.instant('kioskFlows.dailyLog.moves', { count: this.moveCount() }));
    if (this.receiveCount() > 0) parts.push(this.translate.instant('kioskFlows.dailyLog.receives', { count: this.receiveCount() }));
    if (this.issueCount() > 0) parts.push(this.translate.instant('kioskFlows.dailyLog.issues', { count: this.issueCount() }));
    if (this.countCount() > 0) parts.push(this.translate.instant('kioskFlows.dailyLog.counts', { count: this.countCount() }));
    if (this.shipCount() > 0) parts.push(this.translate.instant('kioskFlows.dailyLog.ships', { count: this.shipCount() }));
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

  actionTypeLabel(actionType: string): string {
    const key = SCAN_LOG_ACTION_LABEL_KEYS[actionType];
    return key ? this.translate.instant(key) : actionType;
  }
}
