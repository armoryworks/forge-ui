import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { EodPromptWidgetComponent } from './eod-prompt-widget.component';
import { OpenOrdersWidgetComponent } from './open-orders-widget.component';
import { TodaysTasksWidgetComponent } from './todays-tasks-widget.component';
import { DashboardTask } from '../models/dashboard-task.model';

@Component({
  selector: 'app-focus-mode',
  standalone: true,
  imports: [TranslatePipe, TodaysTasksWidgetComponent, OpenOrdersWidgetComponent, EodPromptWidgetComponent],
  templateUrl: './focus-mode.component.html',
  styleUrl: './focus-mode.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FocusModeComponent {
  readonly tasks = input.required<DashboardTask[]>();
  readonly exitFocus = output<void>();
}
