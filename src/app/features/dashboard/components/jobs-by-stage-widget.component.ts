import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { StageCount } from '../models/dashboard.model';
import { MOCK_STAGES } from '../services/dashboard-mock.data';

@Component({
  selector: 'app-jobs-by-stage-widget',
  standalone: true,
  templateUrl: './jobs-by-stage-widget.component.html',
  styleUrl: './jobs-by-stage-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobsByStageWidgetComponent {
  protected readonly stages = signal<StageCount[]>(MOCK_STAGES);
}
