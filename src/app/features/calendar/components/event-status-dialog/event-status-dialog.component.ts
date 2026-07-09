import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CalendarService } from '../../services/calendar.service';

/** Data for the event-status dialog: the tracking event's id, title, and current status. */
export interface EventStatusDialogData {
  eventId: number;
  title: string;
  currentStatus: string | null;
}

/** Result: the newly-set status, or undefined when cancelled. */
export type EventStatusDialogResult = { status: string } | undefined;

/**
 * compliance-calendar A-4: set the workflow status on a tracking-tier calendar event
 * (Open / In Progress / Done / Waived). Waiving requires a reason. Self-contained — posts
 * to /events/{id}/status and returns the new status to the caller.
 */
@Component({
  selector: 'app-event-status-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, SelectComponent, TextareaComponent],
  templateUrl: './event-status-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventStatusDialogComponent {
  protected readonly data = inject<EventStatusDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EventStatusDialogComponent, EventStatusDialogResult>);
  private readonly service = inject(CalendarService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);

  protected readonly statusOptions: SelectOption[] = [
    { value: 'Open', label: this.translate.instant('calendar.eventStatus.open') },
    { value: 'InProgress', label: this.translate.instant('calendar.eventStatus.inProgress') },
    { value: 'Done', label: this.translate.instant('calendar.eventStatus.done') },
    { value: 'Waived', label: this.translate.instant('calendar.eventStatus.waived') },
  ];

  protected readonly form = new FormGroup({
    status: new FormControl(this.data.currentStatus ?? 'Open', { nonNullable: true }),
    waivedReason: new FormControl('', { nonNullable: true }),
  });

  private readonly status = toSignal(this.form.controls.status.valueChanges, {
    initialValue: this.form.controls.status.value,
  });
  private readonly waivedReason = toSignal(this.form.controls.waivedReason.valueChanges, { initialValue: '' });

  protected readonly isWaived = computed(() => this.status() === 'Waived');
  protected readonly canSave = computed(() => !this.isWaived() || this.waivedReason().trim().length > 0);

  protected save(): void {
    if (!this.canSave() || this.saving()) return;
    const status = this.form.controls.status.value;
    const reason = this.form.controls.waivedReason.value.trim();
    this.saving.set(true);
    this.service.updateEventStatus(this.data.eventId, {
      status,
      waivedReason: status === 'Waived' ? reason : null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('calendar.eventStatus.updated'));
        this.dialogRef.close({ status });
      },
      error: () => this.saving.set(false),
    });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
