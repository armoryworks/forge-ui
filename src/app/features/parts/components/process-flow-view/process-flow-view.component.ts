import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { ProcessStep } from '../../models/process-step.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-process-flow-view',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent],
  templateUrl: './process-flow-view.component.html',
  styleUrl: './process-flow-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessFlowViewComponent {
  readonly steps = input<ProcessStep[]>([]);
}
