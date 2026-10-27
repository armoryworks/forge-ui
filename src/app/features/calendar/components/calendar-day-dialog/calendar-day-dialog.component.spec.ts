import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EventsService } from '../../../events/services/events.service';
import { CalendarDayDialogComponent, CalendarDayDialogData, CalendarDayEvent } from './calendar-day-dialog.component';

@Component({ selector: 'app-dialog', standalone: true, template: '<ng-content />' })
class DialogStubComponent {
  readonly title = input<string>();
  readonly width = input<string>();
  readonly closed = output<void>();
}

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({ 'calendar.dayDialog.allDay': 'All day' }); }
}

describe('CalendarDayDialogComponent', () => {
  let originalTz: string | undefined;

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  function event(id: number, startTime: string, endTime: string, isAllDay: boolean): CalendarDayEvent {
    return {
      id, title: `Event ${id}`, description: null, location: null, startTime, endTime,
      status: null, isRequired: false, isAllDay, color: 'var(--primary)',
    };
  }

  const eventsService = { respondToEvent: vi.fn(() => of(undefined)) };

  function render(events: CalendarDayEvent[]): HTMLElement {
    const data: CalendarDayDialogData = { date: new Date(2026, 9, 30), events, jobs: [], poEvents: [] };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CalendarDayDialogComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader }, lang: 'en' }),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: EventsService, useValue: eventsService },
        { provide: AuthService, useValue: { user: () => ({ id: 7 }) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(CalendarDayDialogComponent, {
      remove: { imports: [DialogComponent] },
      add: { imports: [DialogStubComponent] },
    });
    const fixture = TestBed.createComponent(CalendarDayDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows an all-day event stored at UTC midnight as All day, not as the previous evening', () => {
    const text = render([event(1, '2026-10-30T00:00:00Z', '2026-10-30T00:00:00Z', true)]).textContent ?? '';

    expect(text).toContain('All day');
    expect(text).not.toContain('06:00 PM');
  });

  it('shows a timed event on the 12-hour clock with AM/PM', () => {
    const text = render([event(2, '2026-10-30T15:00:00Z', '2026-10-30T16:30:00Z', false)]).textContent ?? '';

    expect(text).toContain('09:00 AM – 10:30 AM');
    expect(text).not.toContain('All day');
  });

  it('lets an invited employee accept and shows every attendee status', () => {
    eventsService.respondToEvent.mockClear();
    const invited: CalendarDayEvent = {
      ...event(3, '2026-10-30T15:00:00Z', '2026-10-30T16:00:00Z', false),
      myStatus: 'Invited',
      attendees: [
        { id: 1, userId: 7, userName: 'Kelly, Ben', status: 'Invited', respondedAt: null },
        { id: 2, userId: 8, userName: 'Ortiz, Rosa', status: 'Declined', respondedAt: null },
      ],
    };
    const host = render([invited]);

    expect(host.querySelector('[data-testid="event-attendees-3"]')?.textContent).toContain('Ortiz, Rosa');
    (host.querySelector('[data-testid="event-accept-3"]') as HTMLButtonElement).click();

    expect(eventsService.respondToEvent).toHaveBeenCalledWith(3, 'Accepted');
  });

  it('offers no answer buttons on an event the user is not invited to', () => {
    const host = render([event(4, '2026-10-30T15:00:00Z', '2026-10-30T16:00:00Z', false)]);

    expect(host.querySelector('[data-testid="event-rsvp-4"]')).toBeNull();
  });
});
