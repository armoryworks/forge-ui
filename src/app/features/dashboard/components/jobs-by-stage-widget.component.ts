import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { StageCount } from '../models/stage-count.model';

@Component({
  selector: 'app-jobs-by-stage-widget',
  standalone: true,
  templateUrl: './jobs-by-stage-widget.component.html',
  styleUrl: './jobs-by-stage-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobsByStageWidgetComponent {
  readonly stages = input.required<StageCount[]>();
}
