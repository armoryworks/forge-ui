import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { todayStart, toIsoDate } from '../../../../shared/utils/date.utils';

import { PartsService } from '../../services/parts.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartRevision } from '../../models/part-revision.model';

export interface PartReviseDialogData {
  part: PartDetail;
  revisions: PartRevision[];
}

export const REVISION_CODE_MAX_LENGTH = 10;

export function nextRevisionCode(current: string | null | undefined, taken: readonly string[] = []): string {
  const used = new Set(taken.map((t) => t.toUpperCase()));
  let candidate = incrementRevisionCode((current ?? '').trim());
  for (let guard = 0; used.has(candidate.toUpperCase()) && guard < 1000; guard++) {
    candidate = incrementRevisionCode(candidate);
  }
  return candidate;
}

function incrementRevisionCode(code: string): string {
  if (!code) return 'A';

  const digits = /(\d+)$/.exec(code);
  if (digits) {
    const run = digits[1];
    const next = String(Number(run) + 1).padStart(run.length, '0');
    return code.slice(0, code.length - run.length) + next;
  }

  const letters = /([A-Za-z]+)$/.exec(code);
  if (letters) {
    const run = letters[1].split('');
    const prefix = code.slice(0, code.length - run.length);
    for (let i = run.length - 1; i >= 0; i--) {
      const upper = run[i] === run[i].toUpperCase();
      if (run[i].toUpperCase() !== 'Z') {
        run[i] = String.fromCharCode(run[i].charCodeAt(0) + 1);
        return prefix + run.join('');
      }
      run[i] = upper ? 'A' : 'a';
    }
    const lead = letters[1][0] === letters[1][0].toUpperCase() ? 'A' : 'a';
    return prefix + lead + run.join('');
  }

  return `${code}A`;
}

@Component({
  selector: 'app-part-revise-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DatepickerComponent, DialogComponent, InputComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-revise-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartReviseDialogComponent {
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<PartReviseDialogComponent, PartRevision | null>);
  protected readonly data = inject<PartReviseDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly maxLength = REVISION_CODE_MAX_LENGTH;

  protected readonly title = this.translate.instant('partRevisions.dialog.title', { partNumber: this.data.part.partNumber });
  protected readonly currentRevision = this.data.part.revision || this.translate.instant('partRevisions.none');

  protected readonly form = new FormGroup({
    revision: new FormControl<string>(
      nextRevisionCode(this.data.part.revision, this.data.revisions.map((r) => r.revision)),
      { nonNullable: true, validators: [Validators.required, Validators.maxLength(REVISION_CODE_MAX_LENGTH)] },
    ),
    changeReason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    effectiveDate: new FormControl<Date | null>(todayStart(), { validators: [Validators.required] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    revision: this.translate.instant('partRevisions.dialog.revision'),
    changeReason: this.translate.instant('partRevisions.dialog.reason'),
    effectiveDate: this.translate.instant('partRevisions.dialog.effectiveDate'),
  });

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const effectiveDate = toIsoDate(v.effectiveDate);
    if (!effectiveDate) return;
    this.saving.set(true);
    this.partsService.createRevision(this.data.part.id, {
      revision: v.revision.trim(),
      changeReason: v.changeReason.trim(),
      effectiveDate,
    }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('partRevisions.dialog.created', { revision: created.revision }));
        this.dialogRef.close(created);
      },
      error: () => this.saving.set(false),
    });
  }
}
