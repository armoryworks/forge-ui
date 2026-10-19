import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
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

  function setup(roles: string[], scope = 'master'): CalendarInternals {
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
    const component = TestBed.runInInjectionContext(() => {
      const created = new CalendarComponent();
      Object.defineProperty(created, 'scope', { value: signal(scope) });
      return created;
    });
    component.ngOnInit();
    TestBed.flushEffects();
    return component as unknown as CalendarInternals;
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

  it('keeps the compliance calendar to its own events, without jobs or PO deliveries', () => {
    const view = setup(['OfficeManager'], 'module:compliance');

    expect(calendar['getJobs']).not.toHaveBeenCalled();
    expect(calendar['getPoEvents']).not.toHaveBeenCalled();
    expect(view.showPoDeliveries()).toBe(false);
    expect(calendar['getEvents']).toHaveBeenCalled();
  });
});
