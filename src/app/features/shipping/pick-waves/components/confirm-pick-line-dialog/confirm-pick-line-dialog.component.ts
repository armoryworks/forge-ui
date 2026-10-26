import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PickWaveService } from '../../services/pick-wave.service';
import { PickLine } from '../../models/pick-line.model';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

/**
 * Confirms what was picked on one line: the quantity defaults to what was asked for; less than that is a short
 * pick and needs a reason, and more is refused.
 */
@Component({
  selector: 'app-confirm-pick-line-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './confirm-pick-line-dialog.component.html',
  styleUrl: './confirm-pick-line-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmPickLineDialogComponent implements OnInit {
  private readonly pickWaves = inject(PickWaveService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly line = input.required<PickLine>();
  readonly closed = output<void>();
  readonly confirmed = output<void>();

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    pickedQuantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    shortNotes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  private readonly picked = toSignal(this.form.controls.pickedQuantity.valueChanges, { initialValue: null });

  protected readonly isShort = computed(() => {
    const qty = this.picked();
    return qty !== null && qty < this.line().requestedQuantity;
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    pickedQuantity: this.translate.instant('pickWaves.lines.picked'),
    shortNotes: this.translate.instant('pickWaves.confirm.shortReason'),
  });

  ngOnInit(): void {
    const requested = this.line().requestedQuantity;
    this.form.controls.pickedQuantity.addValidators(Validators.max(requested));
    this.form.controls.pickedQuantity.setValue(requested);
    this.form.controls.pickedQuantity.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(qty => {
      const notes = this.form.controls.shortNotes;
      if (qty !== null && qty < requested) notes.addValidators(Validators.required);
      else notes.removeValidators(Validators.required);
      notes.updateValueAndValidity();
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const line = this.line();
    this.saving.set(true);
    this.pickWaves.confirmLine(line.waveId, line.id, {
      pickedQuantity: v.pickedQuantity ?? 0,
      shortNotes: v.shortNotes.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(this.isShort() ? 'pickWaves.confirm.shortRecorded' : 'pickWaves.confirm.picked'));
        this.confirmed.emit();
      },
      error: (err: unknown) => { this.saving.set(false); this.snackbar.errorFrom(err, 'pickWaves.confirm.failed'); },
    });
  }
}
