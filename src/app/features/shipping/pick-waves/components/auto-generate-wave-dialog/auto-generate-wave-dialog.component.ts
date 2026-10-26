import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PickWaveService } from '../../services/pick-wave.service';
import { PickWave } from '../../models/pick-wave.model';
import { PickWaveStrategy } from '../../models/pick-wave-strategy.model';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

const STRATEGIES: readonly PickWaveStrategy[] = ['Zone', 'Batch', 'Discrete', 'WaveByCarrier'];

/**
 * Builds a wave from the open shipment lines due to ship by a date (earliest first), grouped by the chosen
 * picking strategy and capped at a number of lines.
 */
@Component({
  selector: 'app-auto-generate-wave-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, DatepickerComponent, InputComponent, SelectComponent, ValidationButtonComponent],
  templateUrl: './auto-generate-wave-dialog.component.html',
  styleUrl: './auto-generate-wave-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoGenerateWaveDialogComponent {
  private readonly pickWaves = inject(PickWaveService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly created = output<PickWave>();

  protected readonly saving = signal(false);

  protected readonly strategyOptions: SelectOption[] = STRATEGIES.map(s => ({
    value: s, label: this.translate.instant(`pickWaves.strategy.${s}`),
  }));

  protected readonly form = new FormGroup({
    strategy: new FormControl<PickWaveStrategy>('Zone', { nonNullable: true, validators: [Validators.required] }),
    shipBy: new FormControl<Date | null>(null),
    maxLines: new FormControl<number | null>(50, [Validators.required, Validators.min(1), Validators.max(500)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    strategy: this.translate.instant('pickWaves.generate.strategy'),
    shipBy: this.translate.instant('pickWaves.generate.shipBy'),
    maxLines: this.translate.instant('pickWaves.generate.maxLines'),
  });

  protected generate(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const shipBy = v.shipBy
      ? new Date(v.shipBy.getFullYear(), v.shipBy.getMonth(), v.shipBy.getDate(), 23, 59, 59, 999).toISOString()
      : null;
    this.saving.set(true);
    this.pickWaves.autoGenerate({ strategy: v.strategy, shipByDateTo: shipBy, maxLinesPerWave: v.maxLines ?? 50 }).subscribe({
      next: wave => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('pickWaves.generate.created', { number: wave.waveNumber, lines: wave.totalLines }));
        this.created.emit(wave);
      },
      error: (err: unknown) => { this.saving.set(false); this.snackbar.errorFrom(err, 'pickWaves.generate.failed'); },
    });
  }
}
