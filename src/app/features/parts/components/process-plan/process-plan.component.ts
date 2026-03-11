import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { PartsService } from '../../services/parts.service';
import { ProcessStep } from '../../models/process-step.model';
import { ProcessStepDialogComponent, ProcessStepDialogData } from '../process-step-dialog/process-step-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-process-plan',
  standalone: true,
  imports: [EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './process-plan.component.html',
  styleUrl: './process-plan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessPlanComponent {
  private readonly partsService = inject(PartsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  readonly partId = input.required<number>();

  protected readonly steps = signal<ProcessStep[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    effect(() => {
      const id = this.partId();
      if (id) {
        this.loadSteps(id);
      }
    });
  }

  private loadSteps(partId?: number): void {
    const id = partId ?? this.partId();
    this.loading.set(true);
    this.partsService.getProcessSteps(id).subscribe({
      next: (steps) => {
        this.steps.set(steps);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openAddStep(): void {
    this.dialog.open(ProcessStepDialogComponent, {
      width: '520px',
      data: {
        partId: this.partId(),
        nextStepNumber: this.steps().length + 1,
      } satisfies ProcessStepDialogData,
    }).afterClosed().subscribe((result: ProcessStep | undefined) => {
      if (result) {
        this.steps.update(list => [...list, result].sort((a, b) => a.stepNumber - b.stepNumber));
        this.snackbar.success('Process step added.');
      }
    });
  }

  protected openEditStep(step: ProcessStep): void {
    this.dialog.open(ProcessStepDialogComponent, {
      width: '520px',
      data: {
        partId: this.partId(),
        step,
      } satisfies ProcessStepDialogData,
    }).afterClosed().subscribe((result: ProcessStep | undefined) => {
      if (result) {
        this.steps.update(list =>
          list.map(s => s.id === result.id ? result : s).sort((a, b) => a.stepNumber - b.stepNumber),
        );
        this.snackbar.success('Process step updated.');
      }
    });
  }

  protected deleteStep(step: ProcessStep): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Process Step?',
        message: `This will remove step ${step.stepNumber}: "${step.title}" from the process plan.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.deleteProcessStep(this.partId(), step.id).subscribe(() => {
        this.steps.update(list => list.filter(s => s.id !== step.id));
        this.snackbar.success('Process step deleted.');
      });
    });
  }
}
