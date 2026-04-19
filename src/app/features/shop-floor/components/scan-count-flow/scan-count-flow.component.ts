import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanContext } from '../../../../shared/models/scan-action.model';
import { InputComponent } from '../../../../shared/components/input/input.component';

type CountStep = 'enter' | 'confirm';

@Component({
  selector: 'app-scan-count-flow',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './scan-count-flow.component.html',
  styleUrl: './scan-count-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanCountFlowComponent implements OnInit {
  private readonly scanAction = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);

  readonly context = input.required<ScanContext>();
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  protected readonly step = signal<CountStep>('enter');
  protected readonly submitting = signal(false);
  protected readonly countControl = new FormControl<number>(0);

  protected readonly hasDifference = signal(false);
  protected readonly difference = signal(0);

  ngOnInit(): void {
    this.countControl.setValue(this.context().currentStock);
  }

  protected confirmCount(): void {
    const actual = this.countControl.value ?? 0;
    const recorded = this.context().currentStock;
    const diff = actual - recorded;

    this.difference.set(diff);
    this.hasDifference.set(diff !== 0);

    if (diff === 0) {
      // No difference — submit directly
      this.submit();
    } else {
      this.step.set('confirm');
    }
  }

  protected recount(): void {
    this.step.set('enter');
    this.countControl.setValue(this.context().currentStock);
  }

  protected submit(): void {
    const ctx = this.context();
    if (!ctx.currentLocationId) {
      this.snackbar.error('No location set for this part');
      return;
    }

    this.submitting.set(true);
    this.scanAction.count({
      partId: ctx.partId,
      locationId: ctx.currentLocationId,
      actualCount: this.countControl.value ?? 0,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        const diff = this.difference();
        const msg = diff === 0
          ? `Count confirmed: ${ctx.partNumber}`
          : `Count adjusted: ${ctx.partNumber} (${diff > 0 ? '+' : ''}${diff})`;
        this.snackbar.success(msg);
        this.completed.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error('Count failed. Please try again.');
      },
    });
  }
}
