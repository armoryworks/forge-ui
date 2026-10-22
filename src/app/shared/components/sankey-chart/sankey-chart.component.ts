import { ChangeDetectionStrategy, Component, computed, DEFAULT_CURRENCY_CODE, inject, input, LOCALE_ID } from '@angular/core';

import { BaseChartDirective } from '../../charts/base-chart.directive';
import { cssVar } from '../../charts/chart-theme';
import { ThemeService } from '../../services/theme.service';
import { ChartData, ChartOptions } from 'chart.js';

import { SankeyFlowItem } from '../../../features/reports/models/sankey-flow-item.model';
import { TranslatePipe } from '@ngx-translate/core';
import { formatSankeyFlow } from './sankey-flow-format';

interface SankeyDataPoint {
  from: string;
  to: string;
  flow: number;
  unit?: string | null;
}

interface SankeyScriptableContext {
  dataset: { data: SankeyDataPoint[] };
  dataIndex: number;
}

const NODE_COLORS: string[] = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#86bcb6', '#8cd17d', '#b6992d', '#499894', '#d37295',
  '#a0cbe8', '#ffbe7d', '#8b8b8b', '#d4a6c8', '#fabfd2',
];

const NODE_ROW_HEIGHT = 32;
const MIN_LABEL_SHARE = 0.02;

@Component({
  selector: 'app-sankey-chart',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe],
  templateUrl: './sankey-chart.component.html',
  styleUrl: './sankey-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SankeyChartComponent {
  readonly data = input.required<SankeyFlowItem[]>();
  readonly height = input<number>(400);

  private readonly themeService = inject(ThemeService);
  private readonly currencyCode = inject(DEFAULT_CURRENCY_CODE);
  private readonly locale = inject(LOCALE_ID);

  protected readonly chartHeight = computed(() => {
    const items = this.data();
    const sources = new Set(items.map(i => i.from));
    const targets = new Set(items.map(i => i.to));
    return Math.max(this.height(), Math.max(sources.size, targets.size) * NODE_ROW_HEIGHT);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly chartData = computed<ChartData<any>>(() => {
    this.themeService.theme();
    const items = this.data();
    const dataPoints: SankeyDataPoint[] = items.map(i => ({
      from: i.from,
      to: i.to,
      flow: i.flow,
      unit: i.unit,
    }));

    const nodes = new Set<string>();
    items.forEach(i => { nodes.add(i.from); nodes.add(i.to); });
    const nodeList = [...nodes];
    const colorMap = new Map<string, string>();
    nodeList.forEach((n, i) => colorMap.set(n, NODE_COLORS[i % NODE_COLORS.length]));

    const inflow = new Map<string, number>();
    const outflow = new Map<string, number>();
    items.forEach(i => {
      outflow.set(i.from, (outflow.get(i.from) ?? 0) + i.flow);
      inflow.set(i.to, (inflow.get(i.to) ?? 0) + i.flow);
    });
    const total = nodeList
      .filter(n => !inflow.has(n))
      .reduce((sum, n) => sum + (outflow.get(n) ?? 0), 0);
    const labels: Record<string, string> = {};
    nodeList.forEach(n => {
      const size = Math.max(inflow.get(n) ?? 0, outflow.get(n) ?? 0);
      labels[n] = total > 0 && size / total < MIN_LABEL_SHARE ? '' : n;
    });

    return {
      datasets: [{
        label: '',
        data: dataPoints,
        colorFrom: (ctx: SankeyScriptableContext) => {
          const dp = ctx.dataset.data[ctx.dataIndex];
          return dp ? colorMap.get(dp.from) ?? '#999' : '#999';
        },
        colorTo: (ctx: SankeyScriptableContext) => {
          const dp = ctx.dataset.data[ctx.dataIndex];
          return dp ? colorMap.get(dp.to) ?? '#999' : '#999';
        },
        colorMode: 'gradient' as const,
        color: cssVar('--text', '#1e293b'),
        font: { size: 12 },
        nodePadding: 16,
        labels,
      }],
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly chartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: SankeyScriptableContext) => {
            const dp = ctx.dataset.data[ctx.dataIndex];
            return `${dp.from} → ${dp.to}: ${formatSankeyFlow(dp.flow, dp.unit, this.currencyCode, this.locale)}`;
          },
        },
      },
    },
  };
}
