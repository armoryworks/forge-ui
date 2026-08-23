import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ProfitAndLoss } from '../../models/accounting.models';

const INCOME_COLOR = '#16a34a';
const EXPENSE_COLOR = '#dc2626';
const NET_POSITIVE_COLOR = '#2563eb';

/**
 * Visual (chart) presentation of the P&L for visual learners — a waterfall that
 * reads left to right: revenue rises, expenses draw it down, net income remains.
 * KPI figures sit above the chart for at-a-glance reading. Dumb component; the
 * P&L smart component supplies the report and owns the Classic/Visual toggle.
 */
@Component({
  selector: 'app-profit-loss-visual',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe, CurrencyDisplayComponent],
  templateUrl: './profit-loss-visual.component.html',
  styleUrl: './profit-loss-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfitLossVisualComponent {
  private readonly translate = inject(TranslateService);

  readonly report = input.required<ProfitAndLoss>();

  protected readonly netColor = computed(() =>
    this.report().netIncome >= 0 ? NET_POSITIVE_COLOR : EXPENSE_COLOR,
  );

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const r = this.report();
    const income = r.totalIncome;
    const net = r.netIncome;

    return {
      type: 'bar',
      data: {
        labels: [
          this.translate.instant('accounting.profitLoss.income'),
          this.translate.instant('accounting.profitLoss.expense'),
          this.translate.instant('accounting.profitLoss.netIncome'),
        ],
        datasets: [
          {
            label: this.translate.instant('accounting.profitLoss.title'),
            // Floating bars: revenue rises from 0, expenses draw down to net, net stands.
            data: [
              [0, income],
              [net, income],
              [Math.min(0, net), Math.max(0, net)],
            ] as unknown as number[],
            backgroundColor: [INCOME_COLOR, EXPENSE_COLOR, this.netColor()],
            borderWidth: 0,
            maxBarThickness: 96,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const raw = ctx.raw as [number, number];
                const magnitude = Math.abs(raw[1] - raw[0]);
                return `${ctx.label}: ${magnitude.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`;
              },
            },
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (v) => `${v}`,
              font: { size: 10 },
            },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: {
            ticks: { font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    };
  });
}
