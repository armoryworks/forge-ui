import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

import { SpcService } from '../services/spc.service';
import { SpcChartData, SpcCharacteristic } from '../models/spc.model';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { KpiChipComponent } from '../../../shared/components/kpi-chip/kpi-chip.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';

@Component({
  selector: 'app-spc-chart',
  standalone: true,
  imports: [DecimalPipe, BaseChartDirective, LoadingBlockDirective, KpiChipComponent],
  templateUrl: './spc-chart.component.html',
  styleUrl: './spc-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpcChartComponent {
  private readonly spcService = inject(SpcService);
  private readonly snackbar = inject(SnackbarService);

  readonly characteristic = input.required<SpcCharacteristic>();

  protected readonly loading = signal(false);
  protected readonly chartData = signal<SpcChartData | null>(null);

  protected readonly xBarChartData = computed<ChartData<'line'>>(() => {
    const data = this.chartData();
    if (!data || data.points.length === 0) return { labels: [], datasets: [] };

    const labels = data.points.map(p => `#${p.subgroupNumber}`);
    const means = data.points.map(p => p.mean);
    const oocIndices = data.points.map(p => p.isOoc);

    const datasets: ChartData<'line'>['datasets'] = [
      {
        label: 'X-bar',
        data: means,
        borderColor: 'var(--primary)',
        backgroundColor: means.map((_, i) => oocIndices[i] ? '#ef4444' : 'var(--primary)'),
        pointBackgroundColor: means.map((_, i) => oocIndices[i] ? '#ef4444' : '#3b82f6'),
        pointRadius: means.map((_, i) => oocIndices[i] ? 6 : 3),
        tension: 0,
        fill: false,
      },
    ];

    if (data.activeLimits) {
      const len = labels.length;
      datasets.push(
        { label: 'UCL', data: Array(len).fill(data.activeLimits.xBarUcl), borderColor: '#ef4444', borderDash: [5, 5], pointRadius: 0, fill: false },
        { label: 'CL', data: Array(len).fill(data.activeLimits.xBarCenterLine), borderColor: '#6b7280', borderDash: [3, 3], pointRadius: 0, fill: false },
        { label: 'LCL', data: Array(len).fill(data.activeLimits.xBarLcl), borderColor: '#ef4444', borderDash: [5, 5], pointRadius: 0, fill: false },
      );
    }

    return { labels, datasets };
  });

  protected readonly rangeChartData = computed<ChartData<'line'>>(() => {
    const data = this.chartData();
    if (!data || data.points.length === 0) return { labels: [], datasets: [] };

    const labels = data.points.map(p => `#${p.subgroupNumber}`);
    const ranges = data.points.map(p => p.range);

    const datasets: ChartData<'line'>['datasets'] = [
      {
        label: 'Range',
        data: ranges,
        borderColor: '#8b5cf6',
        pointBackgroundColor: '#8b5cf6',
        pointRadius: 3,
        tension: 0,
        fill: false,
      },
    ];

    if (data.activeLimits) {
      const len = labels.length;
      datasets.push(
        { label: 'UCL', data: Array(len).fill(data.activeLimits.rangeUcl), borderColor: '#ef4444', borderDash: [5, 5], pointRadius: 0, fill: false },
        { label: 'CL', data: Array(len).fill(data.activeLimits.rangeCenterLine), borderColor: '#6b7280', borderDash: [3, 3], pointRadius: 0, fill: false },
        { label: 'LCL', data: Array(len).fill(data.activeLimits.rangeLcl), borderColor: '#ef4444', borderDash: [5, 5], pointRadius: 0, fill: false },
      );
    }

    return { labels, datasets };
  });

  protected readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { ticks: { font: { size: 9 } } },
      y: { ticks: { font: { size: 10 } } },
    },
  };

  constructor() {
    effect(() => {
      const char = this.characteristic();
      if (char) this.loadChartData(char.id);
    });
  }

  private loadChartData(characteristicId: number): void {
    this.loading.set(true);
    this.spcService.getChartData(characteristicId, 50).subscribe({
      next: data => { this.chartData.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected recalculateLimits(): void {
    this.loading.set(true);
    this.spcService.recalculateLimits(this.characteristic().id).subscribe({
      next: () => {
        this.loadChartData(this.characteristic().id);
        this.snackbar.success('Control limits recalculated');
      },
      error: () => this.loading.set(false),
    });
  }
}
