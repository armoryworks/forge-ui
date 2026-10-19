import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import { TerminologyService } from '../../shared/services/terminology.service';
import { TermSetStore } from '../../shared/terminology/term-set.store';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { KanbanService } from '../kanban/services/kanban.service';
import { CalendarComponent } from './calendar.component';
import { CalendarService } from './services/calendar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface CalendarInternals {
  canReadPoDeliveries: boolean;
  showPoDeliveries(): boolean;
  eventsByDate(): Map<string, { title: string }[]>;
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
        provideHttpClient(),
        provideHttpClientTesting(),
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

  it('renames job wording in generated events and leaves typed titles alone', async () => {
    localStorage.clear();
    const start = new Date(2026, 10, 3, 9).toISOString();
    const event = (id: number, title: string, isSystemGenerated: boolean) => ({
      id, title, description: null, startTime: start, endTime: start, location: null, eventType: 'Other',
      isRequired: false, isCancelled: false, status: null, eventTypeId: null, superGroupId: null, isSystemGenerated,
    });
    calendar['getEvents'] = vi.fn(() => of([event(1, 'Work Order Due: J-4 - Bracket run', true), event(2, 'Job fair', false)]));
    const view = setup(['OfficeManager']);
    await TestBed.inject(TermSetStore).loadEngine();
    TestBed.inject(TerminologyService).applyEntries([{ key: 'entity_job', label: 'Ticket' }]);

    const titles = [...view.eventsByDate().values()].flat().map(e => e.title);
    expect(titles).toEqual(['Ticket Due: J-4 - Bracket run', 'Job fair']);
    localStorage.clear();
  });

  it('loads jobs and PO deliveries for an office manager', () => {
    setup(['OfficeManager']);

    expect(calendar['getJobs']).toHaveBeenCalled();
    expect(calendar['getPoEvents']).toHaveBeenCalled();
  });
});
