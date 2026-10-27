import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { Operation } from '../../models/operation.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { deadEndStepIds, effectivePredecessors, routingDepths } from '../../utils/routing-predecessors.utils';

interface FlowNode {
  operation: Operation;
  follows: string | null;
  waitsFor: string | null;
}

@Component({
  selector: 'app-routing-flow-view',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent, DurationMsPipe],
  templateUrl: './routing-flow-view.component.html',
  styleUrl: './routing-flow-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingFlowViewComponent {
  readonly operations = input<Operation[]>([]);

  protected readonly deadEnds = computed(() => deadEndStepIds(this.operations()));

  protected readonly columns = computed<FlowNode[][]>(() => {
    const operations = this.operations();
    const depths = routingDepths(operations);
    const links = effectivePredecessors(operations);
    const columns: FlowNode[][] = [];
    for (const operation of [...operations].sort((a, b) => a.stepNumber - b.stepNumber || a.id - b.id)) {
      const depth = depths.get(operation.id) ?? 0;
      const own = links.get(operation.id) ?? [];
      const waits = own.filter(link => link.gate === 'Complete');
      (columns[depth] ??= []).push({
        operation,
        follows: own.length > 0 ? own.map(link => link.stepNumber).join(', ') : null,
        waitsFor: waits.length > 0 ? waits.map(link => link.stepNumber).join(', ') : null,
      });
    }
    return columns.filter(column => column !== undefined);
  });
}
