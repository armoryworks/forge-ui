import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { OeeComponent } from './oee.component';
import { OeeService } from './services/oee.service';
import { OeeCalculation } from './models/oee-calculation.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface OeeInternals {
  ngOnInit(): void;
  dateRangeControl: FormControl<{ start: Date | null; end: Date | null }>;
  selectWorkCenter(id: number): void;
  selectedWorkCenterId: () => number | null;
  averageOee: () => number;
}

function workCenter(id: number, oeePercent: number, hasProduction = true): OeeCalculation {
  return { workCenterId: id, workCenterName: `WC ${id}`, oeePercent, hasProduction } as OeeCalculation;
}

function setup(report: OeeCalculation[]) {
  const service = {
    getOeeReport: vi.fn().mockReturnValue(of(report)),
    getOeeTrend: vi.fn().mockReturnValue(of([])),
    getSixBigLosses: vi.fn().mockReturnValue(of(null)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: OeeService, useValue: service },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new OeeComponent()) as unknown as OeeInternals;
  component.ngOnInit();
  return { component, service };
}

describe('OeeComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('reloads the selected work center detail when the period changes', () => {
    const { component, service } = setup([workCenter(1, 70), workCenter(2, 50)]);
    component.selectWorkCenter(2);
    service.getOeeTrend.mockClear();
    service.getSixBigLosses.mockClear();

    component.dateRangeControl.setValue({ start: new Date(2026, 9, 12), end: new Date(2026, 9, 18) });

    expect(service.getOeeTrend).toHaveBeenCalledWith(2, '2026-10-12', '2026-10-18', 'Daily');
    expect(service.getSixBigLosses).toHaveBeenCalledWith(2, '2026-10-12', '2026-10-18');
    expect(component.selectedWorkCenterId()).toBe(2);
  });

  it('leaves work centers with no runs out of the average', () => {
    const { component } = setup([workCenter(1, 80), workCenter(2, 0, false)]);

    expect(component.averageOee()).toBe(80);
  });
});
