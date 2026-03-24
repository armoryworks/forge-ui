import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TrainingService } from '../../../training/services/training.service';
import { WalkthroughStep, WalkthroughPopover } from '../../models/walkthrough-step.model';

export interface WalkthroughPreviewDialogData {
  moduleId: number;
  moduleTitle: string;
  steps: WalkthroughStep[];
}

@Component({
  selector: 'app-walkthrough-preview-dialog',
  standalone: true,
  imports: [FormsModule, DialogComponent],
  templateUrl: './walkthrough-preview-dialog.component.html',
  styleUrl: './walkthrough-preview-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalkthroughPreviewDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<WalkthroughPreviewDialogComponent>);
  private readonly data = inject<WalkthroughPreviewDialogData>(MAT_DIALOG_DATA);
  private readonly trainingService = inject(TrainingService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly saving = signal(false);
  protected readonly steps = signal<WalkthroughStep[]>(structuredClone(this.data.steps));
  protected readonly moduleTitle = this.data.moduleTitle;

  protected readonly sideOptions = ['top', 'bottom', 'left', 'right'] as const;

  protected updatePopover(index: number, patch: Partial<WalkthroughPopover>): void {
    this.steps.update(steps =>
      steps.map((s, i) => i === index ? { ...s, popover: { ...s.popover, ...patch } } : s)
    );
  }

  protected updateElement(index: number, value: string): void {
    this.steps.update(steps =>
      steps.map((s, i) => i === index ? { ...s, element: value.trim() || null } : s)
    );
  }

  protected moveUp(index: number): void {
    if (index === 0) return;
    this.steps.update(steps => {
      const copy = [...steps];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  }

  protected moveDown(index: number): void {
    if (index >= this.steps().length - 1) return;
    this.steps.update(steps => {
      const copy = [...steps];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      return copy;
    });
  }

  protected deleteStep(index: number): void {
    this.steps.update(steps => steps.filter((_, i) => i !== index));
  }

  protected addStep(): void {
    this.steps.update(steps => [
      ...steps,
      { element: null, popover: { title: 'New Step', description: '', side: 'bottom', align: 'start' } },
    ]);
  }

  protected save(): void {
    this.saving.set(true);
    this.trainingService.updateModule(this.data.moduleId, {
      contentJson: JSON.stringify({ steps: this.steps() }),
    } as never).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('Walkthrough steps saved');
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error('Failed to save steps');
      },
    });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
