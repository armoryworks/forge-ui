import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ConfirmSendService, CONFIRM_BEFORE_SEND_PREF_KEY } from './confirm-send.service';
import { UserPreferencesService } from './user-preferences.service';

describe('ConfirmSendService', () => {
  let service: ConfirmSendService;
  let dialogOpenSpy: ReturnType<typeof vi.fn>;
  let preferencesGetSpy: ReturnType<typeof vi.fn>;

  function setup(prefValue: boolean | null, dialogResult?: unknown): void {
    dialogOpenSpy = vi.fn().mockReturnValue({ afterClosed: () => of(dialogResult) });
    preferencesGetSpy = vi.fn().mockReturnValue(prefValue);

    TestBed.configureTestingModule({
      providers: [
        ConfirmSendService,
        { provide: MatDialog, useValue: { open: dialogOpenSpy } },
        { provide: UserPreferencesService, useValue: { get: preferencesGetSpy } },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string, params?: Record<string, unknown>) =>
              params ? `${key}:${JSON.stringify(params)}` : key,
          },
        },
      ],
    });

    service = TestBed.inject(ConfirmSendService);
  }

  it('opens the confirm dialog when the preference is absent (default ON)', () => {
    setup(null, true);

    let result: boolean | undefined;
    service.confirmSend({ titleKey: 't', messageKey: 'm' }).subscribe(r => (result = r));

    expect(preferencesGetSpy).toHaveBeenCalledWith(CONFIRM_BEFORE_SEND_PREF_KEY);
    expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('bypasses the dialog and emits true when the preference is false', () => {
    setup(false);

    let result: boolean | undefined;
    service.confirmSend({ titleKey: 't', messageKey: 'm' }).subscribe(r => (result = r));

    expect(dialogOpenSpy).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('emits false when the user cancels the dialog', () => {
    setup(true, false);

    let result: boolean | undefined;
    service.confirmSend({ titleKey: 't', messageKey: 'm' }).subscribe(r => (result = r));

    expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });

  it('emits false when the dialog is dismissed without a choice', () => {
    setup(true, undefined);

    let result: boolean | undefined;
    service.confirmSend({ titleKey: 't', messageKey: 'm' }).subscribe(r => (result = r));

    expect(result).toBe(false);
  });

  it('passes translated strings, warn severity, and 400px width to the dialog', () => {
    setup(null, true);

    service
      .confirmSend({ titleKey: 'my.title', messageKey: 'my.message', messageParams: { number: 'Q-1' } })
      .subscribe();

    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        width: '400px',
        data: expect.objectContaining({
          title: 'my.title',
          message: 'my.message:{"number":"Q-1"}',
          confirmLabel: 'confirmSend.confirm',
          severity: 'warn',
        }),
      }),
    );
  });

  it('uses a custom confirm label key when provided', () => {
    setup(null, true);

    service
      .confirmSend({ titleKey: 't', messageKey: 'm', confirmLabelKey: 'custom.send' })
      .subscribe();

    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: expect.objectContaining({ confirmLabel: 'custom.send' }) }),
    );
  });
});
