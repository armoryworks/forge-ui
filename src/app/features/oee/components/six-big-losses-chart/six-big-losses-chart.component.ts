import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { TranslatePipe } from '@ngx-translate/core';
import { ChartConfiguration } from 'chart.js';

import { SixBigLosses } from '../../models/six-big-losses.model';

@Component({
  selector: 'app-six-big-losses-chart',
  standalone: true,
  imports: [BaseChartDirective, DecimalPipe, TranslatePipe],
  templateUrl: './six-big-losses-chart.component.html',
  styleUrl: './six-big-losses-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SixBigLossesChartComponent {
  readonly data = input.required<SixBigLosses>();

  protected readonly losses = computed(() => {
    const d = this.data();
    return [
      { label: 'Equipment Failure', value: d.equipmentFailureMinutes, color: 'var(--error)' },
      { label: 'Setup & Adjustment', value: d.setupAdjustmentMinutes, color: 'var(--warning)' },
      { label: 'Idling & Minor Stops', value: d.idlingMinutes, color: 'var(--info)' },
      { label: 'Reduced Speed', value: d.reducedSpeedMinutes, color: 'var(--primary)' },
      { label: 'Process Defects', value: d.processDefectsMinutes, color: 'var(--error-light, #f87171)' },
      { label: 'Reduced Yield', value: d.reducedYieldMinutes, color: 'var(--warning-light, #fbbf24)' },
    ];
  });

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const items = this.losses();

    return {
      type: 'bar',
      data: {
        labels: items.map(i => i.label),
        datasets: [{
          label: 'Minutes Lost',
          data: items.map(i => i.value),
          backgroundColor: [
            '#ef4444', '#f59e0b', '#3b82f6', '#6366f1', '#f87171', '#fbbf24',
          ],
          borderWidth: 0,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${(ctx.parsed.x ?? 0).toFixed(0)} minutes`,
            },
          },
        },
        scales: {
          x: {
            ticks: { callback: v => `${v} min`, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            ticks: { font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    };
  });
}
