import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { BaseChartDirective } from '../../../../shared/charts/base-chart.directive';
import { ChartData, ChartEvent, ChartOptions } from 'chart.js';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { formValidationContext } from '../../../../shared/interceptors/http-error.interceptor';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { ReportBuilderService } from '../../services/report-builder.service';
import {
  ReportEntityDefinition,
  ReportFieldDefinition,
  ReportFilter,
  ReportFilterOperator,
  ReportChartType,
  SavedReport,
  RunReportResponse,
} from '../../models/report-builder.model';
import { SaveReportDialogComponent, SaveReportDialogData } from '../save-report-dialog/save-report-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

interface FilterRow {
  fieldControl: FormControl<string>;
  operatorControl: FormControl<ReportFilterOperator>;
  valueControl: FormControl<string>;
}

/** Colors for bar/line chart datasets — indexed cyclically */
const CHART_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
];
const CHART_COLOR_PRIMARY = CHART_COLORS[0];
const CHART_COLOR_DIM = 'rgba(59, 130, 246, 0.2)';

@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    BaseChartDirective,
    PageLayoutComponent,
    DataTableComponent,
    InputComponent,
    SelectComponent,
    EmptyStateComponent,
    ValidationButtonComponent,
    SpacerDirective,
    LoadingBlockDirective,
    TranslatePipe,
    MatTooltipModule,
  ],
  templateUrl: './report-builder.component.html',
  styleUrl: './report-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportBuilderComponent {
  private readonly builderService = inject(ReportBuilderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  // Form controls
  protected readonly entityControl = new FormControl<string>('', { nonNullable: true });
  protected readonly savedReportControl = new FormControl<number | null>(null);
  protected readonly groupByControl = new FormControl<string>('', { nonNullable: true });
  protected readonly sortControl = new FormControl<string>('', { nonNullable: true });
  protected readonly directionControl = new FormControl<string>('asc', { nonNullable: true });
  protected readonly chartTypeControl = new FormControl<ReportChartType | ''>('', { nonNullable: true });
  protected readonly chartLabelControl = new FormControl<string>('', { nonNullable: true });
  protected readonly chartValueControl = new FormControl<string>('', { nonNullable: true });

  private readonly entitySource = toSignal(this.entityControl.valueChanges, { initialValue: this.entityControl.value });
  protected readonly chartType = toSignal(this.chartTypeControl.valueChanges, { initialValue: this.chartTypeControl.value });
  private readonly chartLabel = toSignal(this.chartLabelControl.valueChanges, { initialValue: this.chartLabelControl.value });
  private readonly chartValue = toSignal(this.chartValueControl.valueChanges, { initialValue: this.chartValueControl.value });

  // State
  protected readonly selectedColumns = signal<string[]>([]);
  protected readonly filters = signal<FilterRow[]>([]);
  protected readonly reportResults = signal<RunReportResponse | null>(null);
  protected readonly isRunning = signal(false);
  protected readonly runError = signal(false);
  protected readonly editingReport = signal<SavedReport | null>(null);

  /** Currently active drill-down filter value (label clicked in chart). Null = no filter. */
  protected readonly drillFilter = signal<string | null>(null);
  private readonly resultsTable = viewChild(DataTableComponent);

  protected readonly exportFileName = computed(() => {
    const name = this.editingReport()?.name ?? this.entitySource() ?? 'report';
    const slug = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
    return `${slug}-${toDateOnly(new Date())}`;
  });

  // Derived from service
  protected readonly entities = this.builderService.entities;
  protected readonly savedReports = this.builderService.savedReports;

  // Computed: entity options for the select dropdown
  protected readonly entityOptions = computed<SelectOption[]>(() => {
    return [
      { value: '', label: this.translate.instant('reports.selectEntity') },
      ...this.entities().map(e => ({ value: e.entitySource, label: e.label })),
    ];
  });

  // Computed: saved report options
  protected readonly savedReportOptions = computed<SelectOption[]>(() => {
    return [
      { value: null, label: this.translate.instant('common.none') },
      ...this.savedReports().map(r => ({ value: r.id, label: r.name })),
    ];
  });

  // Computed: selected entity definition
  protected readonly selectedEntity = computed<ReportEntityDefinition | null>(() => {
    const src = this.entitySource();
    if (!src) return null;
    return this.entities().find(e => e.entitySource === src) ?? null;
  });

  // Computed: available fields for the selected entity
  protected readonly availableFields = computed<ReportFieldDefinition[]>(() => {
    return this.selectedEntity()?.fields ?? [];
  });

  // Computed: filterable field options
  protected readonly filterableFieldOptions = computed<SelectOption[]>(() => {
    return this.availableFields()
      .filter(f => f.isFilterable)
      .map(f => ({ value: f.field, label: f.label }));
  });

  // Computed: groupable field options
  protected readonly groupableFieldOptions = computed<SelectOption[]>(() => {
    return [
      { value: '', label: this.translate.instant('common.none') },
      ...this.availableFields()
        .filter(f => f.isGroupable)
        .map(f => ({ value: f.field, label: f.label })),
    ];
  });

  // Computed: sortable field options
  protected readonly sortableFieldOptions = computed<SelectOption[]>(() => {
    return [
      { value: '', label: this.translate.instant('common.none') },
      ...this.availableFields()
        .filter(f => f.isSortable)
        .map(f => ({ value: f.field, label: f.label })),
    ];
  });

  // Computed: all field options (for chart label)
  protected readonly fieldOptions = computed<SelectOption[]>(() => {
    return this.availableFields().map(f => ({ value: f.field, label: f.label }));
  });

  // Computed: numeric field options (for chart value)
  protected readonly numericFieldOptions = computed<SelectOption[]>(() => {
    return this.availableFields()
      .filter(f => f.type === 'number')
      .map(f => ({ value: f.field, label: f.label }));
  });

  // Computed: can run the report
  protected readonly canRun = computed<boolean>(() => {
    return !!this.entitySource() && this.selectedColumns().length > 0;
  });

  protected readonly runBlockers = computed<string[]>(() => {
    if (!this.entitySource()) return [this.translate.instant('reports.chooseDataSourceFirst')];
    if (this.selectedColumns().length === 0) return [this.translate.instant('reports.pickColumnFirst')];
    return [];
  });

  // Computed: result columns for DataTable
  protected readonly resultColumns = computed<ColumnDef[]>(() => {
    const results = this.reportResults();
    if (!results) return [];
    const entity = this.selectedEntity();
    return results.columns.map(col => {
      const fieldDef = entity?.fields.find(f => f.field === col);
      const colType = fieldDef?.type === 'number' ? 'number'
        : fieldDef?.type === 'date' ? 'date'
        : 'text';
      return {
        field: col,
        header: fieldDef?.label ?? col,
        sortable: true,
        type: colType as 'text' | 'number' | 'date',
        align: colType === 'number' ? 'right' as const : 'left' as const,
      };
    });
  });

  /**
   * The field used to group the chart (chartLabelControl) is also the field
   * used to filter rows when the user drills into a bar/slice.
   */
  private readonly chartGroupByField = computed<string>(() => this.chartLabel());

  /**
   * Rows filtered by the active drill selection.
   * When drillFilter is null, all rows are shown.
   */
  protected readonly filteredRows = computed<Record<string, unknown>[]>(() => {
    const results = this.reportResults();
    if (!results) return [];
    const filter = this.drillFilter();
    const field = this.chartGroupByField();
    if (!filter || !field) return results.rows;
    return results.rows.filter(row => String(row[field] ?? '') === filter);
  });

  // Computed: chart data from results — highlights the active drill bar
  protected readonly chartData = computed<ChartData | null>(() => {
    const results = this.reportResults();
    const chartType = this.chartType();
    const labelField = this.chartLabel();
    const valueField = this.chartValue();

    if (!results || !chartType || chartType === 'table' || !labelField || !valueField) {
      return null;
    }

    const labels = results.rows.map(r => String(r[labelField] ?? ''));
    const data = results.rows.map(r => Number(r[valueField] ?? 0));
    const activeFilter = this.drillFilter();

    if (chartType === 'pie' || chartType === 'doughnut') {
      const bgColors = labels.map((label, i) => {
        const base = CHART_COLORS[i % CHART_COLORS.length];
        if (!activeFilter) return base;
        return label === activeFilter ? base : base + '33'; // 20% opacity via hex alpha
      });
      return {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
        }],
      };
    }

    // Bar / line: dim non-active bars
    const bgColors = labels.map(label => {
      if (!activeFilter) return 'rgba(59, 130, 246, 0.7)';
      return label === activeFilter ? CHART_COLOR_PRIMARY : CHART_COLOR_DIM;
    });

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: labels.map(label =>
          !activeFilter || label === activeFilter ? CHART_COLOR_PRIMARY : CHART_COLOR_DIM,
        ),
        label: this.availableFields().find(f => f.field === valueField)?.label ?? valueField,
        tension: chartType === 'line' ? 0.3 : undefined,
        fill: chartType === 'line' ? true : undefined,
      }],
    };
  });

  // Static options
  protected readonly operatorOptions: SelectOption[] = [
    { value: 'Equals', label: this.translate.instant('reports.operatorEquals') },
    { value: 'NotEquals', label: this.translate.instant('reports.operatorNotEquals') },
    { value: 'Contains', label: this.translate.instant('reports.operatorContains') },
    { value: 'StartsWith', label: this.translate.instant('reports.operatorStartsWith') },
    { value: 'GreaterThan', label: this.translate.instant('reports.operatorGreaterThan') },
    { value: 'LessThan', label: this.translate.instant('reports.operatorLessThan') },
    { value: 'GreaterThanOrEqual', label: this.translate.instant('reports.operatorGreaterOrEqual') },
    { value: 'LessThanOrEqual', label: this.translate.instant('reports.operatorLessOrEqual') },
    { value: 'Between', label: this.translate.instant('reports.operatorBetween') },
    { value: 'IsNull', label: this.translate.instant('reports.operatorIsNull') },
    { value: 'IsNotNull', label: this.translate.instant('reports.operatorIsNotNull') },
    { value: 'In', label: this.translate.instant('reports.operatorIn') },
  ];

  protected readonly directionOptions: SelectOption[] = [
    { value: 'asc', label: this.translate.instant('reports.directionAscending') },
    { value: 'desc', label: this.translate.instant('reports.directionDescending') },
  ];

  protected readonly chartTypeOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('common.none') },
    { value: 'table', label: this.translate.instant('reports.chartTableOnly') },
    { value: 'bar', label: this.translate.instant('reports.chartBar') },
    { value: 'line', label: this.translate.instant('reports.chartLine') },
    { value: 'pie', label: this.translate.instant('reports.chartPie') },
    { value: 'doughnut', label: this.translate.instant('reports.chartDoughnut') },
  ];

  protected readonly chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    // Pointer cursor so the user knows the chart is clickable
    onHover: (event, elements) => {
      if (event.native?.target instanceof HTMLElement) {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    },
  };

  constructor() {
    this.builderService.loadEntities();
    this.builderService.loadSavedReports();

    // Reset columns/filters when entity changes
    this.entityControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.selectedColumns.set([]);
      this.filters.set([]);
      this.groupByControl.setValue('');
      this.sortControl.setValue('');
      this.chartTypeControl.setValue('');
      this.chartLabelControl.setValue('');
      this.chartValueControl.setValue('');
      this.reportResults.set(null);
      this.drillFilter.set(null);
    });

    // Load saved report when selected
    this.savedReportControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      if (id) this.loadSavedReport(id);
    });
  }

  protected isColumnSelected(field: string): boolean {
    return this.selectedColumns().includes(field);
  }

  protected toggleColumn(field: string): void {
    const cols = this.selectedColumns();
    if (cols.includes(field)) {
      this.selectedColumns.set(cols.filter(c => c !== field));
    } else {
      this.selectedColumns.set([...cols, field]);
    }
  }

  protected addFilter(): void {
    this.filters.set([
      ...this.filters(),
      {
        fieldControl: new FormControl<string>('', { nonNullable: true }),
        operatorControl: new FormControl<ReportFilterOperator>('Equals', { nonNullable: true }),
        valueControl: new FormControl<string>('', { nonNullable: true }),
      },
    ]);
  }

  protected removeFilter(index: number): void {
    const updated = [...this.filters()];
    updated.splice(index, 1);
    this.filters.set(updated);
  }

  protected runReport(): void {
    if (!this.canRun()) return;
    this.isRunning.set(true);
    this.runError.set(false);
    this.drillFilter.set(null);

    const filterValues: ReportFilter[] = this.filters().map(f => ({
      field: f.fieldControl.value,
      operator: f.operatorControl.value,
      value: f.valueControl.value || undefined,
    }));

    this.builderService.runReport({
      entitySource: this.entityControl.value,
      columns: this.selectedColumns(),
      filters: filterValues,
      groupByField: this.groupByControl.value || undefined,
      sortField: this.sortControl.value || undefined,
      sortDirection: this.directionControl.value || undefined,
    }).subscribe({
      next: (results) => {
        this.reportResults.set(results);
        this.isRunning.set(false);
      },
      error: () => {
        this.reportResults.set(null);
        this.runError.set(true);
        this.isRunning.set(false);
      },
    });
  }

  /**
   * Handle chart bar/slice click from ng2-charts (chartClick) output.
   * Toggles drillFilter: clicking the same bar clears the filter.
   */
  protected onChartClick(event: { event?: ChartEvent; active?: object[] }): void {
    const active = event.active;
    if (!active || active.length === 0) {
      this.drillFilter.set(null);
      return;
    }

    const clickedIndex = (active[0] as { index?: number }).index;
    if (clickedIndex === undefined) return;

    const data = this.chartData();
    const label = data?.labels?.[clickedIndex];
    const labelStr = label !== undefined ? String(label) : null;

    // Toggle: clicking the already-active bar clears the drill filter
    this.drillFilter.update(current => (current === labelStr ? null : labelStr));
  }

  protected clearDrillFilter(): void {
    this.drillFilter.set(null);
  }

  protected openSaveDialog(): void {
    const existing = this.editingReport();
    this.dialog.open(SaveReportDialogComponent, {
      width: '420px',
      data: {
        name: existing?.name ?? '',
        description: existing?.description ?? '',
        isShared: existing?.isShared ?? false,
        submit: result => this.saveReport(result.name, result.description, result.isShared),
      } satisfies SaveReportDialogData,
    });
  }

  protected newReport(): void {
    this.editingReport.set(null);
    this.savedReportControl.setValue(null);
    this.entityControl.setValue('');
    this.selectedColumns.set([]);
    this.filters.set([]);
    this.groupByControl.setValue('');
    this.sortControl.setValue('');
    this.directionControl.setValue('asc');
    this.chartTypeControl.setValue('');
    this.chartLabelControl.setValue('');
    this.chartValueControl.setValue('');
    this.reportResults.set(null);
    this.drillFilter.set(null);
  }

  protected deleteSelectedReport(): void {
    const editing = this.editingReport();
    if (!editing) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('reports.deleteReportTitle'),
        message: this.translate.instant('reports.deleteReportConfirm', { name: editing.name }),
        confirmLabel: this.translate.instant('common.delete'),
        cancelLabel: this.translate.instant('common.cancel'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.builderService.deleteReport(editing.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('reports.reportDeleted'));
          this.newReport();
        },
      });
    });
  }

  protected exportCsv(): void {
    this.resultsTable()?.exportCsv();
  }

  private loadSavedReport(id: number): void {
    this.builderService.getSavedReport(id).subscribe({
      next: (report) => {
        this.editingReport.set(report);
        this.entityControl.setValue(report.entitySource);

        // Wait a tick for entity change to propagate fields
        setTimeout(() => {
          this.selectedColumns.set(report.columns);
          this.groupByControl.setValue(report.groupByField ?? '');
          this.sortControl.setValue(report.sortField ?? '');
          this.directionControl.setValue(report.sortDirection ?? 'asc');
          this.chartTypeControl.setValue((report.chartType as ReportChartType) ?? '');
          this.chartLabelControl.setValue(report.chartLabelField ?? '');
          this.chartValueControl.setValue(report.chartValueField ?? '');

          const filterRows: FilterRow[] = report.filters.map(f => ({
            fieldControl: new FormControl<string>(f.field, { nonNullable: true }),
            operatorControl: new FormControl<ReportFilterOperator>(f.operator, { nonNullable: true }),
            valueControl: new FormControl<string>(f.value ?? '', { nonNullable: true }),
          }));
          this.filters.set(filterRows);
          this.drillFilter.set(null);
          if (this.canRun()) this.runReport();
        });
      },
    });
  }

  private saveReport(name: string, description: string, isShared: boolean): Observable<unknown> {
    const filterValues: ReportFilter[] = this.filters().map(f => ({
      field: f.fieldControl.value,
      operator: f.operatorControl.value,
      value: f.valueControl.value || undefined,
    }));

    const request = {
      name,
      description: description || undefined,
      entitySource: this.entityControl.value,
      columns: this.selectedColumns(),
      filters: filterValues,
      groupByField: this.groupByControl.value || undefined,
      sortField: this.sortControl.value || undefined,
      sortDirection: this.directionControl.value || undefined,
      chartType: (this.chartTypeControl.value as ReportChartType) || undefined,
      chartLabelField: this.chartLabelControl.value || undefined,
      chartValueField: this.chartValueControl.value || undefined,
      isShared,
    };

    const existing = this.editingReport();
    if (existing) {
      return this.builderService.updateReport(existing.id, request, formValidationContext()).pipe(
        tap(() => this.snackbar.success(this.translate.instant('reports.reportUpdated'))),
      );
    }
    return this.builderService.createReport(request, formValidationContext()).pipe(
      tap(saved => {
        this.editingReport.set(saved);
        this.snackbar.success(this.translate.instant('reports.reportSaved'));
      }),
    );
  }
}
