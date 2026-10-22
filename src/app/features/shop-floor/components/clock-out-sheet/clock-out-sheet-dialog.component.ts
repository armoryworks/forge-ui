import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ClockOutSheetData } from '../../models/clock-out-sheet-data.model';
import { ClockOutSheetLine } from '../../models/clock-out-sheet-line.model';
import { KioskRunningTimer } from '../../models/kiosk-running-timer.model';

interface SheetRow {
  timer: KioskRunningTimer;
  isStep: boolean;
  form: FormGroup<{ good: FormControl<number | null>; scrap: FormControl<number | null> }>;
}

@Component({
  selector: 'app-clock-out-sheet-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent],
  templateUrl: './clock-out-sheet-dialog.component.html',
  styleUrl: './clock-out-sheet-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockOutSheetDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ClockOutSheetDialogComponent, ClockOutSheetLine[] | undefined>);
  protected readonly data = inject<ClockOutSheetData>(MAT_DIALOG_DATA);

  protected readonly rows: SheetRow[] = this.data.timers.map(timer => ({
    timer,
    isStep: timer.jobId != null && timer.operationId != null,
    form: new FormGroup({
      good: new FormControl<number | null>(null),
      scrap: new FormControl<number | null>(null),
    }),
  }));

  protected stepLabel(timer: KioskRunningTimer): string {
    return timer.stepNumber != null ? `${timer.stepNumber} · ${timer.operationTitle ?? ''}`.trim() : '';
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  protected clockOut(): void {
    this.dialogRef.close(this.rows.map(row => ({
      timer: row.timer,
      goodQuantity: positive(row.form.controls.good.value),
      scrapQuantity: positive(row.form.controls.scrap.value),
    })));
  }
}

function positive(value: number | null): number | null {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}
