import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { toIsoDate } from '../../../../shared/utils/date.utils';

/** Data for the apply-proposal dialog: the proposal title and the event-type choices. */
export interface ApplyProposalDialogData {
  proposalTitle: string;
  eventTypeOptions: SelectOption[];
}

/** Result: the apply payload, or undefined when cancelled. */
export type ApplyProposalDialogResult =
  | { dueDate: string | null; targetEventTypeId: number | null }
  | undefined;

/**
 * Confirms applying a Watchtower regulatory proposal. Optionally scheduling it — a due date +
 * target Event-Type turns the proposal into a system-generated compliance-calendar deadline on
 * confirm. Leaving both blank simply marks the proposal Applied.
 */
@Component({
  selector: 'app-apply-proposal-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, DatepickerComponent, SelectComponent],
  templateUrl: './apply-proposal-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplyProposalDialogComponent {
  protected readonly data = inject<ApplyProposalDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ApplyProposalDialogComponent, ApplyProposalDialogResult>);
  private readonly translate = inject(TranslateService);

  protected readonly eventTypeOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.none') },
    ...this.data.eventTypeOptions,
  ];

  protected readonly form = new FormGroup({
    dueDate: new FormControl<Date | null>(null),
    targetEventTypeId: new FormControl<number | null>(null),
  });

  protected apply(): void {
    const { dueDate, targetEventTypeId } = this.form.getRawValue();
    this.dialogRef.close({
      dueDate: dueDate ? toIsoDate(dueDate) : null,
      targetEventTypeId: targetEventTypeId ?? null,
    });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
