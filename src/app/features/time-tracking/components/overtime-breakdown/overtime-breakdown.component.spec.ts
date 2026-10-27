import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { OvertimeBreakdownComponent } from './overtime-breakdown.component';
import { TimeTrackingService } from '../../services/time-tracking.service';
import { OvertimeBreakdown } from '../../models/overtime.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface OvertimeInternals {
  employeeControl: FormControl<number | null>;
  weekControl: FormControl<Date | null>;
  breakdown: () => OvertimeBreakdown | null;
  ruleSummary: () => string;
  staffOptions: () => { value: unknown }[];
  ngOnInit(): void;
}

const BREAKDOWN: OvertimeBreakdown = {
  regularHours: 40, overtimeHours: 4, doubletimeHours: 0, regularCost: 800, overtimeCost: 120, doubletimeCost: 0, totalCost: 920,
  dailyBreakdown: [{ date: '2026-10-19', totalHours: 10, regularHours: 8, overtimeHours: 2, doubletimeHours: 0 }],
  ruleName: 'Default', dailyThresholdsFirst: true, dailyThresholdHours: 8, weeklyThresholdHours: 40,
};

function setup() {
  const service = {
    getStaff: vi.fn().mockReturnValue(of([{ id: 7, name: 'Kelly, Ben' }])),
    getOvertimeBreakdown: vi.fn().mockReturnValue(of(BREAKDOWN)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: TimeTrackingService, useValue: service },
      { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  vi.spyOn(translate, 'instant').mockImplementation((key: string | string[], params?: object) =>
    `${String(key)}${params ? ' ' + JSON.stringify(params) : ''}`);
  const component = TestBed.runInInjectionContext(() => new OvertimeBreakdownComponent()) as unknown as OvertimeInternals;
  component.ngOnInit();
  return { component, service };
}

describe('OvertimeBreakdownComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('waits for an employee before asking for a breakdown', () => {
    const { component, service } = setup();
    expect(component.staffOptions().length).toBe(1);
    expect(service.getOvertimeBreakdown).not.toHaveBeenCalled();
    expect(component.breakdown()).toBeNull();
  });

  it('loads the chosen employee\'s week and names the rule applied', () => {
    const { component, service } = setup();
    component.weekControl.setValue(new Date(2026, 9, 21));
    component.employeeControl.setValue(7);

    expect(service.getOvertimeBreakdown).toHaveBeenLastCalledWith(7, '2026-10-21');
    expect(component.breakdown()?.overtimeHours).toBe(4);
    expect(component.ruleSummary()).toContain('timeTracking.overtime.ruleDaily');
    expect(component.ruleSummary()).toContain('"weekly":40');
  });
});
