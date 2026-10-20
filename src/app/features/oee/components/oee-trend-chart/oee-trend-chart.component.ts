import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from '../../../../shared/charts/base-chart.directive';
import { cssVar, translucent } from '../../../../shared/charts/chart-theme';
import { ThemeService } from '../../../../shared/services/theme.service';
import { TranslatePipe } from '@ngx-translate/core';
import { ChartConfiguration } from 'chart.js';

import { OeeTrendPoint } from '../../models/oee-trend-point.model';

@Component({
  selector: 'app-oee-trend-chart',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe],
  templateUrl: './oee-trend-chart.component.html',
  styleUrl: './oee-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OeeTrendChartComponent {
  private readonly themeService = inject(ThemeService);

  readonly data = input.required<OeeTrendPoint[]>();

  protected readonly chartConfig = computed<ChartConfiguration<'line'>>(() => {
    this.themeService.theme();
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
            borderColor: cssVar('--primary', '#0f766e'),
            backgroundColor: translucent(cssVar('--primary', '#0f766e'), 0.12),
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
          },
          {
            label: 'Availability',
            data: points.map(p => +(p.availability * 100).toFixed(1)),
            borderColor: cssVar('--success', '#15803d'),
            borderWidth: 1.5,
            pointRadius: 2,
            borderDash: [4, 2],
          },
          {
            label: 'Performance',
            data: points.map(p => +(p.performance * 100).toFixed(1)),
            borderColor: cssVar('--info', '#2563eb'),
            borderWidth: 1.5,
            pointRadius: 2,
            borderDash: [4, 2],
          },
          {
            label: 'Quality',
            data: points.map(p => +(p.quality * 100).toFixed(1)),
            borderColor: cssVar('--warning', '#b45309'),
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
