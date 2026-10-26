import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { BookSettingsCardComponent } from './book-settings-card.component';
import { BookSettingsService } from '../../services/book-settings.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BookSettings } from '../../models/book-settings.model';

interface CardApi {
  ngOnInit(): void;
  form: FormGroup;
  canEdit(): boolean;
  locked(): boolean;
  companyZoneDiffers(): boolean;
  useCompanyZone(): void;
  save(): void;
}

const OPEN: BookSettings = { bookId: 1, code: 'MAIN', name: 'Default Book', makerCheckerThreshold: null, reportingTimeZone: 'America/New_York', timeZoneLocked: false, companyTimeZone: 'America/Denver' };

describe('BookSettingsCardComponent', () => {
  const service = { get: vi.fn(), update: vi.fn() };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  let enabled: Set<string>;

  function create(): CardApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BookSettingsService, useValue: service },
        { provide: SnackbarService, useValue: snackbar },
        { provide: CapabilityService, useValue: { capabilities: signal([]), isEnabled: (code: string) => enabled.has(code) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(BookSettingsCardComponent, { set: { template: '', imports: [], styles: [] } });
    const api = TestBed.createComponent(BookSettingsCardComponent).componentInstance as unknown as CardApi;
    api.ngOnInit();
    return api;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    enabled = new Set(['CAP-ACCT-GL-VIEW', 'CAP-ACCT-FULLGL']);
    service.get.mockReturnValue(of(OPEN));
    service.update.mockImplementation((_id: number, threshold: number | null, zone: string | null) =>
      of({ ...OPEN, makerCheckerThreshold: threshold, reportingTimeZone: zone ?? OPEN.reportingTimeZone }));
  });

  it('saves the threshold and the zone, offering the company zone for an unposted book', () => {
    const api = create();
    expect(api.companyZoneDiffers()).toBe(true);
    api.useCompanyZone();
    api.form.get('makerCheckerThreshold')!.setValue(2500);
    api.save();
    expect(service.update).toHaveBeenCalledWith(1, 2500, 'America/Denver');
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('locks the zone once the book has posted entries and saves only the threshold', () => {
    service.get.mockReturnValue(of({ ...OPEN, timeZoneLocked: true }));
    const api = create();
    expect(api.locked()).toBe(true);
    expect(api.form.get('reportingTimeZone')!.disabled).toBe(true);
    expect(api.companyZoneDiffers()).toBe(false);
    api.save();
    expect(service.update).toHaveBeenCalledWith(1, null, null);
  });

  it('refuses a negative threshold', () => {
    const api = create();
    api.form.get('makerCheckerThreshold')!.setValue(-1);
    api.save();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('is read-only without full GL', () => {
    enabled.delete('CAP-ACCT-FULLGL');
    const api = create();
    expect(api.canEdit()).toBe(false);
    expect(api.form.get('makerCheckerThreshold')!.disabled).toBe(true);
    api.save();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('explains a zone refused as locked by the server', () => {
    service.update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'book-timezone-locked' } })));
    const api = create();
    api.save();
    expect(snackbar.error).toHaveBeenCalledWith('accounting.bookSettings.lockedError');
  });
});
