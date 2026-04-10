import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';

import { EventsService } from '../../../../events/services/events.service';
import { AppEvent } from '../../../../events/models/event.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

@Component({
  selector: 'app-employee-events-tab',
  standalone: true,
  imports: [DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './employee-events-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeEventsTabComponent implements OnInit {
  private readonly eventsService = inject(EventsService);

  readonly employeeId = input.required<number>();

  protected readonly events = signal<AppEvent[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'title', header: 'Title', sortable: true },
    { field: 'eventType', header: 'Type', sortable: true, width: '120px' },
    { field: 'startTime', header: 'Start', sortable: true, type: 'date', width: '160px' },
    { field: 'endTime', header: 'End', sortable: true, type: 'date', width: '160px' },
    { field: 'location', header: 'Location', sortable: true, width: '140px' },
    { field: 'isRequired', header: 'Required', sortable: true, width: '90px' },
    { field: 'status', header: 'RSVP', sortable: true, width: '100px' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    this.eventsService.getUpcomingEventsForUser(this.employeeId()).subscribe({
      next: data => { this.events.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected eventTypeIcon(type: string): string {
    switch (type) {
      case 'Meeting': return 'groups';
      case 'Training': return 'school';
      case 'Safety': return 'health_and_safety';
      default: return 'event';
    }
  }

  protected getAttendeeStatus(event: AppEvent): string {
    const attendee = event.attendees.find(a => a.userId === this.employeeId());
    return attendee?.status ?? 'N/A';
  }
}
