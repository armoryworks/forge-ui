import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { Operation } from '../../models/operation.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-routing-flow-view',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent],
  templateUrl: './routing-flow-view.component.html',
  styleUrl: './routing-flow-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingFlowViewComponent {
  readonly operations = input<Operation[]>([]);
}
