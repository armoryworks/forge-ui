import { ChangeDetectionStrategy, Component, computed, inject, input, LOCALE_ID } from '@angular/core';
import { BaseChartDirective } from '../../../../shared/charts/base-chart.directive';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyService } from '../../../../shared/services/currency.service';
import { WorkCenterCostRate, workCenterRateLabel } from '../../models/costing.model';

// One hue per rate component: labour blues, machine teal, overhead ambers — so a
// bar reads as its labour-vs-machine-vs-overhead composition at a glance.
const LABOR_COLOR = '#2563eb';
const LABOR_OH_COLOR = '#60a5fa';
const MACHINE_COLOR = '#0d9488';
const MACHINE_OH_VAR_COLOR = '#f59e0b';
const MACHINE_OH_FIXED_COLOR = '#b45309';

/**
 * Visual (chart) presentation of frozen work-center cost rates — a stacked bar
 * per work center whose segments are the five rate components (labour, labour
 * overhead, machine, machine overhead variable/fixed), so the cost rollup's
 * composition reads at a glance. Dumb component; the costing smart component
 * supplies the frozen rates and owns the Classic/Visual toggle.
 */
@Component({
  selector: 'app-costing-rates-visual',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe],
  templateUrl: './costing-rates-visual.component.html',
  styleUrl: './costing-rates-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostingRatesVisualComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);
  private readonly currencyService = inject(CurrencyService);

  readonly rates = input.required<WorkCenterCostRate[]>();

  protected readonly ratedCount = computed(() => this.rates().length);

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const rates = this.rates();
    const currency = this.currencyService.baseCurrency();
    const labels = rates.map(workCenterRateLabel);

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.translate.instant('costing.rates.labor'),
            data: rates.map((r) => r.laborRate),
            backgroundColor: LABOR_COLOR,
            borderWidth: 0,
            maxBarThickness: 64,
          },
          {
            label: this.translate.instant('costing.rates.laborOh'),
            data: rates.map((r) => r.laborOhRate),
            backgroundColor: LABOR_OH_COLOR,
            borderWidth: 0,
            maxBarThickness: 64,
          },
          {
            label: this.translate.instant('costing.rates.machine'),
            data: rates.map((r) => r.machineRate),
            backgroundColor: MACHINE_COLOR,
            borderWidth: 0,
            maxBarThickness: 64,
          },
          {
            label: this.translate.instant('costing.rates.mchVar'),
            data: rates.map((r) => r.machineOhVarRate),
            backgroundColor: MACHINE_OH_VAR_COLOR,
            borderWidth: 0,
            maxBarThickness: 64,
          },
          {
            label: this.translate.instant('costing.rates.mchFixed'),
            data: rates.map((r) => r.machineOhFixedRate),
            backgroundColor: MACHINE_OH_FIXED_COLOR,
            borderWidth: 0,
            maxBarThickness: 64,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { font: { size: 11 }, boxWidth: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${(ctx.raw as number).toLocaleString(this.locale, { style: 'currency', currency })}`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            stacked: true,
            ticks: { callback: (v) => Number(v).toLocaleString(this.locale, { style: 'currency', currency }), font: { size: 10 } },
          },
        },
      },
    };
  });
}
