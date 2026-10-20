import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { PriorityIndicatorComponent } from '../../../../shared/components/priority-indicator/priority-indicator.component';
import { CalendarJob } from '../../models/calendar-job.model';
import { PoCalendarEvent } from '../../models/po-calendar-event.model';
import { formatTime } from '../../../../shared/utils/date.utils';
import {
  EventStatusDialogComponent,
  EventStatusDialogData,
  EventStatusDialogResult,
} from '../event-status-dialog/event-status-dialog.component';

/** An event enriched with its layer colour for display in the day-detail dialog. */
export interface CalendarDayEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  status: string | null;
  isRequired: boolean;
  isAllDay: boolean;
  color: string;
}

/** Data payload for the calendar day-detail dialog. */
export interface CalendarDayDialogData {
  date: Date;
  events: CalendarDayEvent[];
  jobs: CalendarJob[];
  poEvents: PoCalendarEvent[];
}

/** Result emitted when the dialog closes with an action (undefined = plain dismiss). */
export type CalendarDayDialogResult =
  | { action: 'job'; job: CalendarJob }
  | { action: 'day' }
  | undefined;

/**
 * Read-only summary of everything scheduled on a single calendar day — compliance
 * events, jobs due, and PO deliveries — opened when a day cell is clicked. Jobs are
 * click-through to the board; "Open day view" hands back to the calendar's inline
 * day agenda for the same date.
 */
@Component({
  selector: 'app-calendar-day-dialog',
  standalone: true,
  imports: [TranslatePipe, DialogComponent, PriorityIndicatorComponent],
  templateUrl: './calendar-day-dialog.component.html',
  styleUrl: './calendar-day-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarDayDialogComponent {
  protected readonly data = inject<CalendarDayDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CalendarDayDialogComponent, CalendarDayDialogResult>);
  private readonly dialog = inject(MatDialog);

  // Events held in a signal so a status change reflects immediately without reopening.
  protected readonly events = signal<CalendarDayEvent[]>(this.data.events);

  protected readonly title = this.data.date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  protected readonly hasContent =
    this.data.events.length > 0 || this.data.jobs.length > 0 || this.data.poEvents.length > 0;

  protected isHighPriority(priority: string): boolean {
    return priority === 'High' || priority === 'Urgent';
  }

  protected getJobTint(job: CalendarJob): string {
    return job.trackTypeColor ?? job.stageColor;
  }

  /** Human time range for a timed event (e.g. "09:00 AM – 10:30 AM"). */
  protected eventTime(evt: CalendarDayEvent): string {
    const start = new Date(evt.startTime);
    const end = new Date(evt.endTime);
    return end.getTime() > start.getTime() ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
  }

  /** Tracking-tier events carry a workflow status; reminder-tier events have none. */
  protected isTracking(evt: CalendarDayEvent): boolean {
    return !!evt.status;
  }

  protected openEventStatus(evt: CalendarDayEvent): void {
    this.dialog.open<EventStatusDialogComponent, EventStatusDialogData, EventStatusDialogResult>(
      EventStatusDialogComponent,
      { width: '480px', autoFocus: false, data: { eventId: evt.id, title: evt.title, currentStatus: evt.status } },
    ).afterClosed().subscribe(result => {
      if (!result) return;
      this.events.update(list => list.map(e => (e.id === evt.id ? { ...e, status: result.status } : e)));
    });
  }

  protected selectJob(job: CalendarJob): void {
    this.dialogRef.close({ action: 'job', job });
  }

  protected openDayView(): void {
    this.dialogRef.close({ action: 'day' });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
