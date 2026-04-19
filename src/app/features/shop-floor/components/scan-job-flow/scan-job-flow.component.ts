import {
  ChangeDetectionStrategy, Component, inject, input, output, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KanbanService } from '../../../kanban/services/kanban.service';

type JobStep = 'actions' | 'confirm-advance' | 'log-note' | 'processing' | 'done';
type CompletedAction = 'timer-started' | 'timer-stopped' | 'stage-advanced' | 'note-logged';

@Component({
  selector: 'app-scan-job-flow',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, TextareaComponent],
  templateUrl: './scan-job-flow.component.html',
  styleUrl: './scan-job-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanJobFlowComponent {
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly kanbanService = inject(KanbanService);

  // Inputs
  readonly jobId = input.required<number>();
  readonly jobNumber = input.required<string>();
  readonly jobTitle = input.required<string>();
  readonly currentStage = input.required<string>();
  readonly assigneeName = input<string | null>(null);
  readonly hasActiveTimer = input<boolean>(false);

  // Outputs
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  // State
  protected readonly step = signal<JobStep>('actions');
  protected readonly processing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly completedAction = signal<CompletedAction | null>(null);
  protected readonly noteControl = new FormControl('');

  protected startTimer(): void {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    this.shopFloorService.startTimer(this.jobId()).subscribe({
      next: () => {
        this.processing.set(false);
        this.completedAction.set('timer-started');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: () => {
        this.processing.set(false);
        this.error.set('Failed to start timer');
        this.step.set('actions');
      },
    });
  }

  protected stopTimer(): void {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    this.shopFloorService.stopTimer().subscribe({
      next: () => {
        this.processing.set(false);
        this.completedAction.set('timer-stopped');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: () => {
        this.processing.set(false);
        this.error.set('Failed to stop timer');
        this.step.set('actions');
      },
    });
  }

  protected showAdvanceStage(): void {
    this.step.set('confirm-advance');
  }

  protected confirmAdvanceStage(): void {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    this.shopFloorService.completeJob(this.jobId()).subscribe({
      next: () => {
        this.processing.set(false);
        this.completedAction.set('stage-advanced');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: () => {
        this.processing.set(false);
        this.error.set('Failed to advance stage');
        this.step.set('actions');
      },
    });
  }

  protected showLogNote(): void {
    this.noteControl.reset();
    this.step.set('log-note');
  }

  protected submitNote(): void {
    const noteText = this.noteControl.value?.trim();
    if (!noteText || this.processing()) return;

    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    this.kanbanService.addComment(this.jobId(), noteText).subscribe({
      next: () => {
        this.processing.set(false);
        this.completedAction.set('note-logged');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: () => {
        this.processing.set(false);
        this.error.set('Failed to log note');
        this.step.set('log-note');
      },
    });
  }

  protected backToActions(): void {
    this.step.set('actions');
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
