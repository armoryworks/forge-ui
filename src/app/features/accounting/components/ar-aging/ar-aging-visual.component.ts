import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ArAging } from '../../models/accounting.models';

// Reds deepen with age: youngest bucket lightest, oldest bucket deepest.
const AGING_RAMP = ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d'];

/**
 * Visual (chart) presentation of AR aging for visual learners — a bar per aging
 * bucket whose red deepens with age, so overdue concentration reads at a glance.
 * Total outstanding sits above as a KPI. Dumb component; the smart component
 * supplies the report and owns the Classic/Visual toggle.
 */
@Component({
  selector: 'app-ar-aging-visual',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe, CurrencyDisplayComponent],
  templateUrl: './ar-aging-visual.component.html',
  styleUrl: './ar-aging-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArAgingVisualComponent {
  readonly report = input.required<ArAging>();

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const buckets = this.report().totalsByBucket;

    return {
      type: 'bar',
      data: {
        labels: buckets.map((b) => b.label),
        datasets: [
          {
            data: buckets.map((b) => b.amount),
            backgroundColor: buckets.map((_, i) => AGING_RAMP[Math.min(i, AGING_RAMP.length - 1)]),
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
              label: (ctx) =>
                `${ctx.label}: ${(ctx.raw as number).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`,
            },
          },
        },
        scales: {
          y: {
            ticks: { callback: (v) => `${v}`, font: { size: 10 } },
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
