import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AbcClassificationService } from '../../services/abc-classification.service';
import { AbcClassificationResult } from '../../models/abc-classification-result.model';
import { AbcClassificationRun } from '../../models/abc-classification-run.model';

/**
 * Inventory > ABC classification: ranks active parts by annual usage value over a look-back period, splits
 * them into A/B/C at cumulative-value thresholds, previews the proposed class against each part's current
 * class, and applies the run to the parts.
 */
@Component({
  selector: 'app-abc-classification',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe, DateTimePipe, CurrencyDisplayComponent, DataTableComponent,
    ColumnCellDirective, InputComponent, ToggleComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './abc-classification.component.html',
  styleUrl: './abc-classification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbcClassificationComponent {
  private readonly abcService = inject(AbcClassificationService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly running = signal(false);
  protected readonly applying = signal(false);
  protected readonly loadingResults = signal(false);
  protected readonly runs = signal<AbcClassificationRun[]>([]);
  protected readonly activeRun = signal<AbcClassificationRun | null>(null);
  protected readonly results = signal<AbcClassificationResult[]>([]);
  protected readonly appliedRunIds = signal<ReadonlySet<number>>(new Set());

  protected readonly form = new FormGroup({
    lookbackMonths: new FormControl<number | null>(12, [Validators.required, Validators.min(1), Validators.max(60)]),
    classAThresholdPercent: new FormControl<number | null>(80, [Validators.required, Validators.min(1), Validators.max(99)]),
    classBThresholdPercent: new FormControl<number | null>(95, [Validators.required, Validators.min(1), Validators.max(100)]),
  });
  protected readonly changesOnly = new FormControl(false, { nonNullable: true });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    lookbackMonths: this.translate.instant('inventoryScreens.abc.lookbackMonths'),
    classAThresholdPercent: this.translate.instant('inventoryScreens.abc.classAThreshold'),
    classBThresholdPercent: this.translate.instant('inventoryScreens.abc.classBThreshold'),
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  private readonly changesOnlyValue = toSignal(this.changesOnly.valueChanges.pipe(startWith(false)), { initialValue: false });

  protected readonly thresholdsOutOfOrder = computed(() => {
    const v = this.formValue();
    return v.classAThresholdPercent != null && v.classBThresholdPercent != null && v.classBThresholdPercent <= v.classAThresholdPercent;
  });

  protected readonly changedCount = computed(() => this.results().filter(r => r.classification !== r.currentClassification).length);
  protected readonly visibleResults = computed(() =>
    this.changesOnlyValue() ? this.results().filter(r => r.classification !== r.currentClassification) : this.results());
  protected readonly activeRunApplied = computed(() => {
    const run = this.activeRun();
    return run !== null && this.appliedRunIds().has(run.id);
  });

  protected readonly resultRowClass = (row: unknown) => {
    const result = row as AbcClassificationResult;
    return result.classification !== result.currentClassification ? 'abc-row--changed' : '';
  };

  protected readonly resultColumns: ColumnDef[] = [
    { field: 'rank', header: '#', sortable: true, align: 'right', width: '60px' },
    { field: 'partNumber', header: this.translate.instant('inventory.columns.partNumber'), sortable: true, width: '150px' },
    { field: 'partDescription', header: this.translate.instant('common.description'), sortable: true, phoneHidden: true },
    { field: 'annualDemandQuantity', header: this.translate.instant('inventoryScreens.abc.annualQuantity'), sortable: true, align: 'right', width: '110px' },
    { field: 'annualUsageValue', header: this.translate.instant('inventoryScreens.abc.annualValue'), sortable: true, align: 'right', width: '130px' },
    { field: 'cumulativePercent', header: this.translate.instant('inventoryScreens.abc.cumulative'), sortable: true, align: 'right', width: '100px' },
    { field: 'currentClassification', header: this.translate.instant('inventoryScreens.abc.currentClass'), sortable: true, align: 'center', width: '90px' },
    { field: 'classification', header: this.translate.instant('inventoryScreens.abc.proposedClass'), sortable: true, align: 'center', width: '100px' },
  ];

  protected readonly runColumns: ColumnDef[] = [
    { field: 'runDate', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '160px' },
    { field: 'lookbackMonths', header: this.translate.instant('inventoryScreens.abc.lookbackMonths'), sortable: true, align: 'right', width: '120px' },
    { field: 'thresholds', header: this.translate.instant('inventoryScreens.abc.thresholds'), sortable: false, width: '120px' },
    { field: 'totalParts', header: this.translate.instant('inventoryScreens.abc.parts'), sortable: true, align: 'right', width: '80px' },
    { field: 'counts', header: this.translate.instant('inventoryScreens.abc.counts'), sortable: false },
  ];

  constructor() {
    this.loadRuns();
  }

  private loadRuns(): void {
    this.abcService.getRuns().subscribe({ next: runs => this.runs.set(runs) });
  }

  protected run(): void {
    if (this.form.invalid || this.thresholdsOutOfOrder() || this.running()) return;
    const v = this.form.getRawValue();
    this.running.set(true);
    this.abcService.run({
      lookbackMonths: v.lookbackMonths!,
      classAThresholdPercent: v.classAThresholdPercent!,
      classBThresholdPercent: v.classBThresholdPercent!,
    }).subscribe({
      next: run => {
        this.running.set(false);
        this.loadRuns();
        this.openRun(run);
      },
      error: () => this.running.set(false),
    });
  }

  protected openRun(run: AbcClassificationRun): void {
    this.activeRun.set(run);
    this.results.set([]);
    this.loadingResults.set(true);
    this.abcService.getResults(run.id).subscribe({
      next: results => { this.results.set(results); this.loadingResults.set(false); },
      error: () => this.loadingResults.set(false),
    });
  }

  protected apply(): void {
    const run = this.activeRun();
    if (!run || this.applying()) return;
    this.applying.set(true);
    this.abcService.apply(run.id).subscribe({
      next: () => {
        this.applying.set(false);
        this.appliedRunIds.update(ids => new Set(ids).add(run.id));
        this.results.update(results => results.map(r => ({ ...r, currentClassification: r.classification })));
        this.snackbar.success(this.translate.instant('inventoryScreens.abc.applied', { count: run.totalParts }));
      },
      error: () => this.applying.set(false),
    });
  }
}
