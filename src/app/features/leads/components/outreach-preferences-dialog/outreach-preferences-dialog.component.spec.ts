import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LeadsService } from '../../services/leads.service';
import { OutreachPreferences } from '../../models/suppression.model';
import { OutreachPreferencesDialogComponent, OutreachPreferencesDialogData } from './outreach-preferences-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = { ngOnInit(): void; form: FormGroup; save(): void };

function prefs(overrides: Partial<OutreachPreferences> = {}): OutreachPreferences {
  return {
    id: 1, ownerId: 9, emailOptOut: false, emailOptOutAt: null, emailOptOutSource: null,
    callOptOut: false, callOptOutAt: null, callOptOutSource: null,
    smsOptOut: false, smsOptOutAt: null, smsOptOutSource: null,
    cooldownUntil: null, cooldownReasonCode: null, cooldownNotes: null,
    ...overrides,
  };
}

describe('OutreachPreferencesDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let current: OutreachPreferences | null;

  function open(data: OutreachPreferencesDialogData): Internals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: LeadsService, useValue: { getOutreachPreferences: () => of(current), updateOutreachPreferences: update } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    const c = TestBed.runInInjectionContext(() => new OutreachPreferencesDialogComponent()) as unknown as Internals;
    c.ngOnInit();
    return c;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    close = vi.fn();
    current = null;
    update = vi.fn(() => of(prefs({ emailOptOut: true, callOptOut: true, smsOptOut: true })));
  });

  it('starts a queue suppression with every channel opted out', () => {
    const c = open({ leadId: 9, leadName: 'Acme', suppress: true });

    expect(c.form.getRawValue()).toMatchObject({ emailOptOut: true, callOptOut: true, smsOptOut: true });
    expect(c.form.getRawValue().source).toBe('leads.outreachPrefs.queueSource');
  });

  it('shows what is already set instead of the suppression preset', () => {
    current = prefs({ callOptOut: true, callOptOutSource: 'Asked on call', cooldownUntil: '2027-01-01T00:00:00Z' });
    const c = open({ leadId: 9, leadName: 'Acme', suppress: true });

    expect(c.form.getRawValue()).toMatchObject({ emailOptOut: false, callOptOut: true, smsOptOut: false, source: 'Asked on call' });
    expect(c.form.getRawValue().cooldownUntil).toBeInstanceOf(Date);
  });

  it('saves the opt-outs with their source and closes with the saved row', () => {
    const c = open({ leadId: 9, leadName: 'Acme' });
    c.form.patchValue({ emailOptOut: true, source: 'Unsubscribe reply', cooldownUntil: new Date(2027, 0, 15) });

    c.save();

    expect(update).toHaveBeenCalledWith(9, {
      emailOptOut: true,
      emailOptOutSource: 'Unsubscribe reply',
      callOptOut: false,
      callOptOutSource: undefined,
      smsOptOut: false,
      smsOptOutSource: undefined,
      cooldownUntil: '2027-01-15T00:00:00Z',
      cooldownNotes: undefined,
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ emailOptOut: true }));
  });

  it('loads and saves through a supplied source instead of the lead endpoints', () => {
    const load = vi.fn(() => of(prefs({ smsOptOut: true, smsOptOutSource: 'Text STOP' })));
    const saveToSource = vi.fn(() => of(prefs({ smsOptOut: true, emailOptOut: true })));
    const c = open({ leadName: 'Lovelace, Ada', source: { load, save: saveToSource } });

    expect(load).toHaveBeenCalled();
    expect(c.form.getRawValue()).toMatchObject({ smsOptOut: true, source: 'Text STOP' });
    c.form.patchValue({ emailOptOut: true });
    c.save();

    expect(saveToSource).toHaveBeenCalledWith(expect.objectContaining({ emailOptOut: true, smsOptOut: true }));
    expect(update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
