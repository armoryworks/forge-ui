import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

import { OeeTrendPoint } from '../../models/oee-trend-point.model';

@Component({
  selector: 'app-oee-trend-chart',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './oee-trend-chart.component.html',
  styleUrl: './oee-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OeeTrendChartComponent {
  readonly data = input.required<OeeTrendPoint[]>();

  protected readonly chartConfig = computed<ChartConfiguration<'line'>>(() => {
    const points = this.data();
    const labels = points.map(p => p.date);

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'OEE',
            data: points.map(p => +(p.oee * 100).toFixed(1)),
            borderColor: 'var(--primary)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
          },
          {
            label: 'Availability',
            data: points.map(p => +(p.availability * 100).toFixed(1)),
            borderColor: 'var(--success)',
            borderWidth: 1.5,
            pointRadius: 2,
            borderDash: [4, 2],
          },
          {
            label: 'Performance',
            data: points.map(p => +(p.performance * 100).toFixed(1)),
            borderColor: 'var(--info)',
            borderWidth: 1.5,
            pointRadius: 2,
            borderDash: [4, 2],
          },
          {
            label: 'Quality',
            data: points.map(p => +(p.quality * 100).toFixed(1)),
            borderColor: 'var(--warning)',
            borderWidth: 1.5,
            pointRadius: 2,
            borderDash: [4, 2],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: v => `${v}%`, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: {
            ticks: { font: { size: 10 }, maxRotation: 45 },
            grid: { display: false },
          },
        },
      },
    };
  });
}
