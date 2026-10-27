import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DOWNTIME_CATEGORIES } from '../../models/downtime-categories.const';
import { DowntimeCategory } from '../../models/downtime-category.type';
import { DowntimeDialogData } from '../../models/downtime-dialog-data.model';
import { DowntimeLog } from '../../models/downtime-log.model';
import { AssetsService } from '../../services/assets.service';

@Component({
  selector: 'app-downtime-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './downtime-dialog.component.html',
  styleUrl: './downtime-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DowntimeDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<DowntimeDialogComponent, DowntimeLog | undefined>);
  protected readonly data = inject<DowntimeDialogData>(MAT_DIALOG_DATA);
  private readonly assetsService = inject(AssetsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly assetOptions = signal<SelectOption[]>([]);
  protected readonly pickAsset = this.data.asset === null;

  protected readonly categoryOptions: SelectOption[] = DOWNTIME_CATEGORIES.map(value => ({
    value, label: this.translate.instant(`downtime.categories.${value}`),
  }));

  readonly form = new FormGroup({
    assetId: new FormControl<number | null>(this.data.asset?.id ?? null, [Validators.required]),
    category: new FormControl<DowntimeCategory | null>('EquipmentFailure', [Validators.required]),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    isPlanned: new FormControl<boolean>(false, { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  readonly violations = FormValidationService.getViolations(this.form, {
    assetId: this.translate.instant('downtime.asset'),
    category: this.translate.instant('downtime.category'),
    reason: this.translate.instant('downtime.reason'),
    notes: this.translate.instant('common.notes'),
  });

  ngOnInit(): void {
    if (!this.pickAsset) return;
    this.assetsService.getAssets(undefined, 'Active').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: assets => this.assetOptions.set(assets
        .filter(a => a.assetType === 'Machine' || a.assetType === 'Tooling')
        .map(a => ({ value: a.id, label: a.workCenterCode ? `${a.name} (${a.workCenterCode})` : a.name }))),
      error: () => this.assetOptions.set([]),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    const assetId = raw.assetId!;
    this.saving.set(true);
    this.assetsService.createDowntimeLog(assetId, {
      assetId,
      workCenterId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      category: raw.category,
      downtimeReasonId: null,
      reason: raw.reason.trim(),
      resolution: null,
      description: null,
      isPlanned: raw.isPlanned,
      jobId: null,
      notes: raw.notes.trim() || null,
    }).subscribe({
      next: log => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('downtime.started', { asset: log.assetName }));
        this.dialogRef.close(log);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'downtime.saveFailed');
      },
    });
  }
}
