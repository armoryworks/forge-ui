import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { WorkingCalendarsComponent } from './working-calendars.component';
import { WorkingCalendarsService } from '../services/working-calendars.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

interface ComponentApi {
  renderMask(mask: number): string;
  dayKeys: string[];
  save(): void;
  calendarForm: { patchValue(value: object): void };
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

function create(): { api: ComponentApi; success: ReturnType<typeof vi.fn> } {
  const success = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: WorkingCalendarsService,
        useValue: { list: () => of([]), create: () => of({ id: 8 }) },
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
