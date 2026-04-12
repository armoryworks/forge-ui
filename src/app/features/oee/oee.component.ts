import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../shared/directives/spacer.directive';
import { SelectComponent } from '../../shared/components/select/select.component';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { KpiChipComponent } from '../../shared/components/kpi-chip/kpi-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SelectOption } from '../../shared/components/select/select.component';
import { OeeService } from './services/oee.service';
import { OeeCalculation } from './models/oee-calculation.model';
import { OeeTrendPoint } from './models/oee-trend-point.model';
import { SixBigLosses } from './models/six-big-losses.model';
import { OeeTrendGranularity } from './models/oee-trend-granularity.type';
import { OeeWorkCenterCardComponent } from './components/oee-work-center-card/oee-work-center-card.component';
import { OeeTrendChartComponent } from './components/oee-trend-chart/oee-trend-chart.component';
import { SixBigLossesChartComponent } from './components/six-big-losses-chart/six-big-losses-chart.component';

@Component({
  selector: 'app-oee',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    PageLayoutComponent,
    ToolbarComponent,
    SpacerDirective,
    SelectComponent,
    DateRangePickerComponent,
    KpiChipComponent,
    EmptyStateComponent,
    LoadingBlockDirective,
    OeeWorkCenterCardComponent,
    OeeTrendChartComponent,
    SixBigLossesChartComponent,
  ],
  templateUrl: './oee.component.html',
  styleUrl: './oee.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OeeComponent implements OnInit {
  private readonly oeeService = inject(OeeService);
  private readonly destroyRef = inject(DestroyRef);

  // State
  protected readonly loading = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly workCenters = signal<OeeCalculation[]>([]);
  protected readonly selectedWorkCenterId = signal<number | null>(null);
  protected readonly trendData = signal<OeeTrendPoint[]>([]);
  protected readonly lossesData = signal<SixBigLosses | null>(null);

  // Date range — default last 30 days
  protected readonly dateRangeControl = new FormControl<{ start: Date | null; end: Date | null }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  // Granularity control
  protected readonly granularityControl = new FormControl<OeeTrendGranularity>('Daily');
  protected readonly granularityOptions: SelectOption[] = [
    { value: 'Daily', label: 'Daily' },
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Monthly', label: 'Monthly' },
  ];

  // Computed
  protected readonly selectedWorkCenter = computed(() => {
    const id = this.selectedWorkCenterId();
    return id ? this.workCenters().find(wc => wc.workCenterId === id) ?? null : null;
  });

  protected readonly averageOee = computed(() => {
    const wcs = this.workCenters();
    if (wcs.length === 0) return 0;
    return wcs.reduce((sum, wc) => sum + wc.oeePercent, 0) / wcs.length;
  });

  protected readonly worldClassCount = computed(() =>
    this.workCenters().filter(wc => wc.isWorldClass).length,
  );

  ngOnInit(): void {
    this.loadWorkCenters();

    this.dateRangeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadWorkCenters());

    this.granularityControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const id = this.selectedWorkCenterId();
        if (id) this.loadDetail(id);
      });
  }

  protected loadWorkCenters(): void {
    const range = this.dateRangeControl.value;
    if (!range?.start || !range?.end) return;

    const dateFrom = this.formatDateOnly(range.start);
    const dateTo = this.formatDateOnly(range.end);

    this.loading.set(true);
    this.oeeService.getOeeReport(dateFrom, dateTo).subscribe({
      next: data => {
        this.workCenters.set(data);
        this.loading.set(false);
        // Auto-select first if none selected
        if (!this.selectedWorkCenterId() && data.length > 0) {
          this.selectWorkCenter(data[0].workCenterId);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  protected selectWorkCenter(id: number): void {
    this.selectedWorkCenterId.set(id);
    this.loadDetail(id);
  }

  private loadDetail(workCenterId: number): void {
    const range = this.dateRangeControl.value;
    if (!range?.start || !range?.end) return;

    const dateFrom = this.formatDateOnly(range.start);
    const dateTo = this.formatDateOnly(range.end);
    const granularity = this.granularityControl.value ?? 'Daily';

    this.detailLoading.set(true);

    this.oeeService.getOeeTrend(workCenterId, dateFrom, dateTo, granularity).subscribe({
      next: data => this.trendData.set(data),
      error: () => this.trendData.set([]),
    });

    this.oeeService.getSixBigLosses(workCenterId, dateFrom, dateTo).subscribe({
      next: data => {
        this.lossesData.set(data);
        this.detailLoading.set(false);
      },
      error: () => {
        this.lossesData.set(null);
        this.detailLoading.set(false);
      },
    });
  }

  private formatDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
