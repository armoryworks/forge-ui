import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SankeyChartComponent } from '../../../../shared/components/sankey-chart/sankey-chart.component';
import { SankeyFlowItem } from '../../../reports/models/sankey-flow-item.model';
import { MrpPlannedOrder } from '../../models/mrp.model';

const STATUS_KEYS: Record<string, string> = {
  Planned: 'mrp.filters.planned',
  Firmed: 'mrp.filters.firmed',
  Released: 'mrp.filters.released',
  Cancelled: 'mrp.filters.cancelled',
};

/**
 * Visual (chart) presentation of the MRP plan — a Sankey flow of planned orders
 * from sourcing type (make vs buy) into their lifecycle status, so the make/buy
 * split and how much of the plan is still Planned vs already Released reads at a
 * glance. Dumb component; the MRP smart component supplies the planned orders and
 * owns the Classic/Visual toggle. True demand-supply pegging isn't loaded on this
 * screen, so the flow is built from the planned-orders supply side of the plan.
 */
@Component({
  selector: 'app-mrp-flow-visual',
  standalone: true,
  imports: [SankeyChartComponent, TranslatePipe],
  templateUrl: './mrp-flow-visual.component.html',
  styleUrl: './mrp-flow-visual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrpFlowVisualComponent {
  private readonly translate = inject(TranslateService);

  readonly plannedOrders = input.required<MrpPlannedOrder[]>();

  protected readonly flows = computed<SankeyFlowItem[]>(() => {
    const byPair = new Map<string, Map<string, number>>();
    for (const o of this.plannedOrders()) {
      const from = this.translate.instant(`mrp.orderTypes.${o.orderType.toLowerCase()}`);
      const to = this.translate.instant(STATUS_KEYS[o.status] ?? o.status);
      if (from === to) continue;
      const targets = byPair.get(from) ?? new Map<string, number>();
      targets.set(to, (targets.get(to) ?? 0) + 1);
      byPair.set(from, targets);
    }

    const items: SankeyFlowItem[] = [];
    for (const [from, targets] of byPair) {
      for (const [to, flow] of targets) {
        items.push({ from, to, flow });
      }
    }
    return items;
  });
}
