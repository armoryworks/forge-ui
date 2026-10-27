import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';

import { RecallService } from '../../services/recall.service';
import { RecallDetail } from '../../models/recall-detail.model';
import { RecallImpactPreview } from '../../models/recall-impact-preview.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

export interface InitiateRecallDialogData {
  lotId: number | null;
  lotNumber: string | null;
}

@Component({
  selector: 'app-initiate-recall-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe,
    DialogComponent, TextareaComponent, ValidationButtonComponent, EntityPickerComponent,
  ],
  templateUrl: './initiate-recall-dialog.component.html',
  styleUrl: './initiate-recall-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InitiateRecallDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<InitiateRecallDialogComponent, RecallDetail | undefined>);
  private readonly recallService = inject(RecallService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<InitiateRecallDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly pickLot = this.data.lotId == null;

  protected readonly form = new FormGroup({
    lotId: new FormControl<number | null>(this.data.lotId, [Validators.required]),
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2000), Validators.pattern(/\S/)],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    reason: this.translate.instant('recalls.reason'),
    lotId: this.translate.instant('recalls.pickLot'),
  });

  protected readonly preview = signal<RecallImpactPreview | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly previewFailed = signal(false);

  protected readonly previewCustomers = computed(() => {
    const seen = new Map<number, string>();
    for (const s of this.preview()?.affectedShipments ?? []) seen.set(s.customerId, s.customerName);
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  });

  protected readonly downstreamLotCount = computed(() => Math.max(0, (this.preview()?.affectedLotsCount ?? 0) - 1));

  constructor() {
    this.form.controls.lotId.valueChanges.pipe(
      startWith(this.form.controls.lotId.value),
      distinctUntilChanged(),
      tap(() => {
        this.preview.set(null);
        this.previewFailed.set(false);
      }),
      switchMap(lotId => {
        if (lotId == null) return of(null);
        this.previewLoading.set(true);
        return this.recallService.previewRecall(lotId).pipe(
          catchError(() => {
            this.previewFailed.set(true);
            return of(null);
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(preview => {
      this.previewLoading.set(false);
      this.preview.set(preview);
    });
  }

  protected close(): void { this.dialogRef.close(); }

  protected confirm(): void {
    if (this.form.invalid || this.saving() || this.previewLoading()) return;
    this.saving.set(true);
    this.recallService.initiateRecall({
      recalledLotId: this.form.controls.lotId.value!,
      reason: this.form.controls.reason.value.trim(),
      recallDate: toIsoDate(new Date())!,
    }).subscribe({
      next: (recall) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('recalls.initiated'));
        this.dialogRef.close(recall);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'recalls.initiateFailed');
      },
    });
  }
}
