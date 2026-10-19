import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, Subject } from 'rxjs';

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

describe('CalendarComponent · saved views', () => {
  it('saves one view when Save is pressed twice before the server answers', () => {
    const createSavedView = vi.fn(() => new Subject());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: CalendarService, useValue: {
          getJobs: vi.fn(() => of([])), getPoEvents: vi.fn(() => of([])), getSuperGroups: vi.fn(() => of([])),
          getEvents: vi.fn(() => of([])), getSavedViews: vi.fn(() => of([])), createSavedView,
        } },
        { provide: KanbanService, useValue: { getTrackTypes: () => of([]) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
      ],
    });
    const view = TestBed.runInInjectionContext(() => new CalendarComponent()) as unknown as {
      newViewNameControl: { setValue(v: string): void };
      saveCurrentView(): void;
    };

    view.newViewNameControl.setValue('Shop week');
    view.saveCurrentView();
    view.saveCurrentView();

    expect(createSavedView).toHaveBeenCalledTimes(1);
  });
});
