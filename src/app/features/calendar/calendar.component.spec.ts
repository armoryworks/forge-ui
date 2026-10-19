import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { KanbanService } from '../kanban/services/kanban.service';
import { CalendarComponent } from './calendar.component';
import { CalendarService } from './services/calendar.service';
import { CalendarEvent } from './models/calendar-event.model';
import { CalendarDayEvent } from './components/calendar-day-dialog/calendar-day-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface CalendarInternals {
  canReadPoDeliveries: boolean;
  showPoDeliveries(): boolean;
}

describe('CalendarComponent · role access', () => {
  let calendar: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    calendar = {
      getJobs: vi.fn(() => of([])),
      getPoEvents: vi.fn(() => of([])),
      getSuperGroups: vi.fn(() => of([])),
      getEvents: vi.fn(() => of([])),
      getSavedViews: vi.fn(() => of([])),
    };
  });

  function setup(roles: string[]): CalendarInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: CalendarService, useValue: calendar },
        { provide: KanbanService, useValue: { getTrackTypes: () => of([]) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: UserPreferencesService, useValue: { get: (key: string) => (key === 'calendar:showPo' ? true : null), set: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CalendarComponent()) as unknown as CalendarInternals;
    TestBed.flushEffects();
    return component;
  }

  it('asks a Controller for neither jobs nor PO deliveries, which the API refuses that role', () => {
    const view = setup(['Controller']);

    expect(calendar['getJobs']).not.toHaveBeenCalled();
    expect(calendar['getPoEvents']).not.toHaveBeenCalled();
    expect(view.canReadPoDeliveries).toBe(false);
    expect(view.showPoDeliveries()).toBe(false);
  });

  it('gives Procurement the PO deliveries without the production jobs', () => {
    const view = setup(['Procurement']);

    expect(calendar['getJobs']).not.toHaveBeenCalled();
    expect(calendar['getPoEvents']).toHaveBeenCalled();
    expect(view.canReadPoDeliveries).toBe(true);
  });

  it('loads jobs and PO deliveries for an office manager', () => {
    setup(['OfficeManager']);

    expect(calendar['getJobs']).toHaveBeenCalled();
    expect(calendar['getPoEvents']).toHaveBeenCalled();
  });
});

interface CalendarEventInternals {
  events: { set(events: CalendarEvent[]): void };
  eventsByDate(): Map<string, { id: number }[]>;
  eventsForDay(dateKey: string): CalendarDayEvent[];
}

describe('CalendarComponent · event days', () => {
  let originalTz: string | undefined;

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  function event(id: number, startTime: string, isAllDay: boolean): CalendarEvent {
    return {
      id, title: `Event ${id}`, description: null, startTime, endTime: startTime, location: null,
      eventType: 'Other', isRequired: false, isCancelled: false, status: null,
      eventTypeId: null, superGroupId: null, isAllDay,
    };
  }

  function setup(): CalendarEventInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: CalendarService,
          useValue: {
            getJobs: () => of([]), getPoEvents: () => of([]), getSuperGroups: () => of([]),
            getEvents: () => of([]), getSavedViews: () => of([]),
          },
        },
        { provide: KanbanService, useValue: { getTrackTypes: () => of([]) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: () => false } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CalendarComponent()) as unknown as CalendarEventInternals;
    TestBed.flushEffects();
    return component;
  }

  it('keeps an all-day event stored at UTC midnight on its own day west of UTC', () => {
    const view = setup();
    view.events.set([event(1, '2026-10-30T00:00:00Z', true), event(2, '2026-10-30T17:00:00Z', true)]);

    expect(view.eventsByDate().get('2026-10-30')?.map(e => e.id)).toEqual([1, 2]);
    expect(view.eventsByDate().has('2026-10-29')).toBe(false);
    expect(view.eventsForDay('2026-10-30').map(e => [e.id, e.isAllDay])).toEqual([[1, true], [2, true]]);
  });

  it('places a timed event on its local day', () => {
    const view = setup();
    view.events.set([event(3, '2026-10-30T02:00:00Z', false)]);

    expect(view.eventsByDate().get('2026-10-29')?.map(e => e.id)).toEqual([3]);
    expect(view.eventsForDay('2026-10-30')).toEqual([]);
  });
});
