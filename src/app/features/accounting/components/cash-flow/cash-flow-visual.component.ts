import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CashFlowStatement } from '../../models/accounting.models';

const INFLOW_COLOR = '#16a34a';
const OUTFLOW_COLOR = '#dc2626';
const TOTAL_COLOR = '#2563eb';

/**
 * Visual (chart) presentation of the indirect cash-flow statement — a waterfall
 * that reads left to right: net income, then the operating / investing /
 * financing movements step the running balance up or down, ending at the net
 * change in cash. KPI figures for the net sub-totals sit above. Dumb component;
 * the smart component supplies the report and owns the Classic/Visual toggle.
 */
@Component({
  selector: 'app-cash-flow-visual',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe, CurrencyDisplayComponent],
  templateUrl: './cash-flow-visual.component.html',
  styleUrl: './cash-flow-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowVisualComponent {
  private readonly translate = inject(TranslateService);

  readonly report = input.required<CashFlowStatement>();

  private readonly stepColor = (delta: number): string =>
    delta >= 0 ? INFLOW_COLOR : OUTFLOW_COLOR;
  private readonly totalColor = (value: number): string =>
    value >= 0 ? TOTAL_COLOR : OUTFLOW_COLOR;

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const r = this.report();
    const ni = r.netIncome;
    const op = r.netCashFromOperating;
    const afterInvesting = op + r.netCashFromInvesting;
    const afterFinancing = afterInvesting + r.netCashFromFinancing;
    const net = r.netChangeInCash;
    const operatingAdjustment = op - ni;

    return {
      type: 'bar',
      data: {
        labels: [
          this.translate.instant('accounting.cashFlow.netIncome'),
          this.translate.instant('accounting.cashFlow.operatingAdjustments'),
          this.translate.instant('accounting.cashFlow.investingActivities'),
          this.translate.instant('accounting.cashFlow.financingActivities'),
          this.translate.instant('accounting.cashFlow.netChangeInCash'),
        ],
        datasets: [
          {
            label: this.translate.instant('accounting.cashFlow.title'),
            // Floating bars: each intermediate bar spans the running balance before
            // and after its movement; net income and net change stand from zero.
            data: [
              [0, ni],
              [ni, op],
              [op, afterInvesting],
              [afterInvesting, afterFinancing],
              [Math.min(0, net), Math.max(0, net)],
            ] as unknown as number[],
            backgroundColor: [
              this.totalColor(ni),
              this.stepColor(operatingAdjustment),
              this.stepColor(r.netCashFromInvesting),
              this.stepColor(r.netCashFromFinancing),
              this.totalColor(net),
            ],
            borderWidth: 0,
            maxBarThickness: 72,
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
            ticks: { font: { size: 10 } },
            grid: { display: false },
          },
        },
      },
    };
  });
}
