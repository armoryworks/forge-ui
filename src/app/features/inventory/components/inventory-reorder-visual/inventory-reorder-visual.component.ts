import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InventoryPartSummary } from '../../models/inventory-part-summary.model';
import { LowStockAlert } from '../../models/low-stock-alert.model';

const COLOR_BELOW = '#dc2626';
const COLOR_NEAR = '#d97706';
const COLOR_HEALTHY = '#16a34a';
const COLOR_REORDER = '#94a3b8';
const NEAR_FACTOR = 1.25;
const MAX_ROWS = 20;
const ROW_HEIGHT = 30;

interface ReorderRow {
  partNumber: string;
  available: number;
  reorderPoint: number;
  color: string;
  ratio: number;
}

/**
 * Visual (chart) presentation of inventory reorder health — a horizontal bar per
 * part comparing available stock against its reorder point, colored by status
 * (below reorder = red, approaching = amber, healthy = green). Dumb component;
 * the inventory smart component supplies the stock summaries + low-stock alerts
 * and owns the Classic/Visual toggle. Reorder points come from the low-stock
 * alert feed, so the heatmap covers the parts that carry a configured threshold.
 */
@Component({
  selector: 'app-inventory-reorder-visual',
  standalone: true,
  imports: [BaseChartDirective, TranslatePipe],
  templateUrl: './inventory-reorder-visual.component.html',
  styleUrl: './inventory-reorder-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryReorderVisualComponent {
  private readonly translate = inject(TranslateService);

  readonly parts = input.required<InventoryPartSummary[]>();
  readonly alerts = input.required<LowStockAlert[]>();

  private readonly rows = computed<ReorderRow[]>(() => {
    const availByPart = new Map<number, number>();
    for (const p of this.parts()) availByPart.set(p.partId, p.available);

    return this.alerts()
      .map((a) => {
        const reorderPoint = a.reorderPoint ?? a.minStockThreshold;
        const available = availByPart.get(a.partId) ?? a.currentStock;
        const ratio = reorderPoint > 0 ? available / reorderPoint : available;
        return { partNumber: a.partNumber, available, reorderPoint, color: this.statusColor(available, reorderPoint), ratio };
      })
      .sort((x, y) => x.ratio - y.ratio);
  });

  protected readonly totalCount = computed(() => this.rows().length);
  protected readonly capped = computed(() => this.rows().slice(0, MAX_ROWS));
  protected readonly isCapped = computed(() => this.totalCount() > MAX_ROWS);
  protected readonly chartHeight = computed(() => Math.max(220, this.capped().length * ROW_HEIGHT + 70));

  private statusColor(available: number, reorderPoint: number): string {
    if (available <= 0 || available < reorderPoint) return COLOR_BELOW;
    if (available < reorderPoint * NEAR_FACTOR) return COLOR_NEAR;
    return COLOR_HEALTHY;
  }

  protected readonly chartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const rows = this.capped();
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.partNumber),
        datasets: [
          {
            label: this.translate.instant('inventory.reorderVisual.availableLabel'),
            data: rows.map((r) => r.available),
            backgroundColor: rows.map((r) => r.color),
            borderWidth: 0,
            maxBarThickness: 18,
          },
          {
            label: this.translate.instant('inventory.reorderVisual.reorderPointLabel'),
            data: rows.map((r) => r.reorderPoint),
            backgroundColor: COLOR_REORDER,
            borderWidth: 0,
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}`,
            },
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
    };
  });
}
