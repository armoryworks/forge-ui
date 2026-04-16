import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import 'chartjs-chart-sankey';

import { SankeyFlowItem } from '../../../features/reports/models/sankey-flow-item.model';

interface SankeyDataPoint {
  from: string;
  to: string;
  flow: number;
}

const NODE_COLORS: string[] = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#86bcb6', '#8cd17d', '#b6992d', '#499894', '#d37295',
  '#a0cbe8', '#ffbe7d', '#8b8b8b', '#d4a6c8', '#fabfd2',
];

@Component({
  selector: 'app-sankey-chart',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './sankey-chart.component.html',
  styleUrl: './sankey-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SankeyChartComponent {
  readonly data = input.required<SankeyFlowItem[]>();
  readonly height = input<number>(400);

  protected readonly chartData = computed<ChartData<'sankey'>>(() => {
    const items = this.data();
    const dataPoints: SankeyDataPoint[] = items.map(i => ({
      from: i.from,
      to: i.to,
      flow: i.flow,
    }));

    const nodes = new Set<string>();
    items.forEach(i => { nodes.add(i.from); nodes.add(i.to); });
    const nodeList = [...nodes];
    const colorMap = new Map<string, string>();
    nodeList.forEach((n, i) => colorMap.set(n, NODE_COLORS[i % NODE_COLORS.length]));

    return {
      datasets: [{
        label: '',
        data: dataPoints,
        colorFrom: (ctx) => {
          const dp = ctx.dataset.data[ctx.dataIndex] as SankeyDataPoint | undefined;
          return dp ? colorMap.get(dp.from) ?? '#999' : '#999';
        },
        colorTo: (ctx) => {
          const dp = ctx.dataset.data[ctx.dataIndex] as SankeyDataPoint | undefined;
          return dp ? colorMap.get(dp.to) ?? '#999' : '#999';
        },
        colorMode: 'gradient' as const,
      }],
    };
  });

  protected readonly chartOptions: ChartOptions<'sankey'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const dp = ctx.dataset.data[ctx.dataIndex] as SankeyDataPoint;
            return `${dp.from} → ${dp.to}: ${dp.flow}`;
          },
        },
      },
    },
  };
}
