import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { GrniReconciliation } from '../../models/accounting.models';

// Ambers deepen with size: the largest open-GRNI vendors read darkest, so the
// concentration of uninvoiced receipt liability stands out at a glance.
const SIZE_RAMP = ['#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e'];
const MAX_VENDORS = 12;

/**
 * Visual (chart) presentation of open GRNI for visual learners — a bar per
 * vendor of received-but-not-invoiced value, deepening amber with size so the
 * vendors carrying the most uninvoiced liability read first. Total open GRNI and
 * the GL-vs-operational variance sit above as KPIs. Dumb component; the GRNI
 * smart component supplies the report and owns the Classic/Visual toggle.
 */
@Component({
  selector: 'app-grni-visual',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe, CurrencyDisplayComponent],
  templateUrl: './grni-visual.component.html',
  styleUrl: './grni-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrniVisualComponent {
  readonly report = input.required<GrniReconciliation>();

  /** Open GRNI summed per vendor, largest first, capped so the axis stays legible. */
  private readonly vendorTotals = computed(() => {
    const byVendor = new Map<string, number>();
    for (const po of this.report().purchaseOrders) {
      byVendor.set(po.vendorName, (byVendor.get(po.vendorName) ?? 0) + po.openAmount);
    }
    return [...byVendor.entries()]
      .map(([vendorName, amount]) => ({ vendorName, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_VENDORS);
  });

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const vendors = this.vendorTotals();

    return {
      type: 'bar',
      data: {
        labels: vendors.map((v) => v.vendorName),
        datasets: [
          {
            data: vendors.map((v) => v.amount),
            backgroundColor: vendors.map((_, i) => SIZE_RAMP[Math.min(i, SIZE_RAMP.length - 1)]),
            borderWidth: 0,
            maxBarThickness: 64,
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
