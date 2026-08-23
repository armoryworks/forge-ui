import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { BalanceSheet } from '../../models/accounting.models';

const ASSET_COLOR = '#16a34a';
const LIABILITY_COLOR = '#d97706';
const EQUITY_COLOR = '#2563eb';

/**
 * Visual (chart) presentation of the balance sheet for visual learners — a
 * horizontal stacked bar that sets Total Assets against Liabilities + Equity so
 * the accounting identity reads at a glance (the two bars balance). KPI figures
 * sit above the chart. Dumb component; the smart component supplies the report
 * and owns the Classic/Visual toggle.
 */
@Component({
  selector: 'app-balance-sheet-visual',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe, CurrencyDisplayComponent],
  templateUrl: './balance-sheet-visual.component.html',
  styleUrl: './balance-sheet-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceSheetVisualComponent {
  private readonly translate = inject(TranslateService);

  readonly report = input.required<BalanceSheet>();

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const r = this.report();

    return {
      type: 'bar',
      data: {
        labels: [
          this.translate.instant('accounting.balanceSheet.assets'),
          this.translate.instant('accounting.balanceSheet.liabilitiesAndEquity'),
        ],
        datasets: [
          {
            label: this.translate.instant('accounting.balanceSheet.assets'),
            data: [r.totalAssets, 0],
            backgroundColor: ASSET_COLOR,
            borderWidth: 0,
          },
          {
            label: this.translate.instant('accounting.balanceSheet.liabilities'),
            data: [0, r.totalLiabilities],
            backgroundColor: LIABILITY_COLOR,
            borderWidth: 0,
          },
          {
            label: this.translate.instant('accounting.balanceSheet.equity'),
            data: [0, r.totalEquityWithEarnings],
            backgroundColor: EQUITY_COLOR,
            borderWidth: 0,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                return `${ctx.dataset.label}: ${value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            stacked: true,
            ticks: { font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    };
  });
}
