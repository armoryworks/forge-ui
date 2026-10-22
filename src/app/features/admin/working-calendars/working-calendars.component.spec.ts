import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';

import { WorkingCalendarsComponent } from './working-calendars.component';
import { WorkingCalendarsService } from '../services/working-calendars.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

interface ComponentApi {
  renderMask(mask: number): string;
  dayKeys: string[];
  save(): void;
  calendarForm: { patchValue(value: object): void };
  holidayForm: { patchValue(value: object): void };
  shiftForm: { patchValue(value: object): void };
  addHoliday(): void;
  saveShift(): void;
}

const DAY_LABELS: Record<string, string> = {
  'workingCalendars.daySun': 'Dom',
  'workingCalendars.dayMon': 'Lun',
  'workingCalendars.dayTue': 'Mar',
  'workingCalendars.dayWed': 'Mié',
  'workingCalendars.dayThu': 'Jue',
  'workingCalendars.dayFri': 'Vie',
  'workingCalendars.daySat': 'Sáb',
};

function create(overrides: Record<string, unknown> = {}): { api: ComponentApi; success: ReturnType<typeof vi.fn> } {
  const success = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: WorkingCalendarsService,
        useValue: { list: () => of([]), create: () => of({ id: 8 }), ...overrides },
      },
      { provide: TranslateService, useValue: { instant: (key: string) => DAY_LABELS[key] ?? key } },
      { provide: SnackbarService, useValue: { success, error: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(WorkingCalendarsComponent, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(WorkingCalendarsComponent);
  return { api: fixture.componentInstance as unknown as ComponentApi, success };
}

describe('WorkingCalendarsComponent', () => {
  it('names the days with translation keys, Sunday first', () => {
    const { api } = create();

    expect(api.dayKeys).toEqual(Object.keys(DAY_LABELS));
  });

  it('renders a shift day mask with the translated day initials', () => {
    const { api } = create();

    expect(api.renderMask(0b0111110)).toBe('· L M M J V ·');
  });

  it('announces a created calendar with a translated message', () => {
    const { api, success } = create();
    api.calendarForm.patchValue({ name: 'Plant' });

    api.save();

    expect(success).toHaveBeenCalledWith('workingCalendars.created');
  });
});

describe('WorkingCalendarsComponent · one request per press', () => {
  const calendar = { id: 1, name: 'Plant', timeZone: 'UTC', workingDaysMask: 62, isActive: true, isDefault: true, holidays: [], shifts: [] };

  function withCalendar(extra: Record<string, unknown>): ComponentApi {
    return create({ list: () => of([calendar]), get: () => of(calendar), ...extra }).api;
  }

  function fillHoliday(api: ComponentApi): void {
    api.holidayForm.patchValue({ date: new Date(2026, 11, 25), name: 'Holiday' });
  }

  it('adds one holiday when Add is pressed twice before the server answers', () => {
    const addHoliday = vi.fn(() => new Subject());
    const api = withCalendar({ addHoliday });
    fillHoliday(api);

    api.addHoliday();
    api.addHoliday();

    expect(addHoliday).toHaveBeenCalledTimes(1);
  });

  it('lets Add holiday be pressed again after the server rejects the first press', () => {
    const addHoliday = vi.fn(() => throwError(() => new Error('500')));
    const api = withCalendar({ addHoliday });
    fillHoliday(api);

    api.addHoliday();
    api.addHoliday();

    expect(addHoliday).toHaveBeenCalledTimes(2);
  });

  it('adds one shift when Save is pressed twice before the server answers', () => {
    const addShift = vi.fn(() => new Subject());
    const api = withCalendar({ addShift });
    api.shiftForm.patchValue({ name: 'Day' });

    api.saveShift();
    api.saveShift();

    expect(addShift).toHaveBeenCalledTimes(1);
  });

  it('lets Save shift be pressed again after the server rejects the first press', () => {
    const addShift = vi.fn(() => throwError(() => new Error('500')));
    const api = withCalendar({ addShift });
    api.shiftForm.patchValue({ name: 'Day' });

    api.saveShift();
    api.saveShift();

    expect(addShift).toHaveBeenCalledTimes(2);
  });
});
