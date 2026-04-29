import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PartAlternatesTabComponent } from '../../components/part-alternates-tab/part-alternates-tab.component';

/**
 * Workflow Pattern Phase 5 — Alternates step. Optional step (no completion
 * gates). Wraps the existing `PartAlternatesTabComponent` so the user can
 * add/approve/remove alternates inline as part of the guided flow.
 */
@Component({
  selector: 'app-part-alternates-step',
  standalone: true,
  imports: [TranslatePipe, PartAlternatesTabComponent],
  templateUrl: './part-alternates-step.component.html',
  styleUrl: './part-alternates-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartAlternatesStepComponent {
  readonly stepId = input<string>('alternates');
  readonly componentName = input<string>('PartAlternatesStepComponent');
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);
}
