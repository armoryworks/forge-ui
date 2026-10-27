import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { PayPeriodSettingsComponent } from './pay-period-settings.component';
import { TimeTrackingService } from '../../../time-tracking/services/time-tracking.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PayPeriodInternals {
  form: FormGroup;
  usesAnchor: () => boolean;
  enabled: () => boolean;
  preview: () => unknown[];
  loadPreview(): void;
  save(): void;
}

function setup(enabled = true) {
  const service = {
    getCurrentPayPeriod: vi.fn().mockReturnValue(of({
      type: 'biweekly', periodStart: '2026-10-19T00:00:00Z', periodEnd: '2026-11-01T23:59:59Z', daysRemaining: 6,
      anchorDate: '2026-01-05T00:00:00+00:00',
    })),
    previewPayPeriods: vi.fn().mockReturnValue(of([{ start: '2026-10-19', end: '2026-11-01', isCurrent: true }])),
    updatePayPeriodSettings: vi.fn().mockReturnValue(of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: TimeTrackingService, useValue: service },
      { provide: CapabilityService, useValue: { isEnabled: () => enabled } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new PayPeriodSettingsComponent()) as unknown as PayPeriodInternals;
  return { component, service };
}

describe('PayPeriodSettingsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the saved type and anchor and previews the next periods', () => {
    const { component, service } = setup();
    expect(component.form.get('type')!.value).toBe('biweekly');
    expect((component.form.get('anchorDate')!.value as Date).getDate()).toBe(5);
    expect(service.previewPayPeriods).toHaveBeenCalledWith('biweekly', '2026-01-05');
    expect(component.preview().length).toBe(1);
  });

  it('drops the anchor for calendar-based periods', () => {
    const { component, service } = setup();
    component.form.patchValue({ type: 'semimonthly' });
    component.loadPreview();
    expect(component.usesAnchor()).toBe(false);
    expect(service.previewPayPeriods).toHaveBeenLastCalledWith('semimonthly', null);

    component.save();
    expect(service.updatePayPeriodSettings).toHaveBeenCalledWith('semimonthly', undefined);
  });

  it('saves a weekly schedule with its anchor', () => {
    const { component, service } = setup();
    component.form.patchValue({ type: 'weekly', anchorDate: new Date(2026, 9, 26) });
    component.save();
    expect(service.updatePayPeriodSettings).toHaveBeenCalledWith('weekly', '2026-10-26T00:00:00Z');
  });

  it('stays hidden and silent when time tracking is off', () => {
    const { component, service } = setup(false);
    expect(component.enabled()).toBe(false);
    expect(service.getCurrentPayPeriod).not.toHaveBeenCalled();
  });
});
