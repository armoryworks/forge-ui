import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { FormGroup } from '@angular/forms';

import { ReverseEntryDialogComponent } from './reverse-entry-dialog.component';

interface DialogApi {
  form: FormGroup;
  confirm(): void;
  close(): void;
}

describe('ReverseEntryDialogComponent', () => {
  const dialogRef = { close: vi.fn() };

  function create(): DialogApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { entryNumber: 11 } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(ReverseEntryDialogComponent, { set: { template: '', imports: [] } });
    return TestBed.createComponent(ReverseEntryDialogComponent).componentInstance as unknown as DialogApi;
  }

  beforeEach(() => vi.clearAllMocks());

  it('closes with no result on cancel', () => {
    const api = create();
    api.close();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  it('will not confirm while the reason is empty', () => {
    const api = create();
    api.confirm();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('returns the reversal date and reason when confirmed', () => {
    const api = create();
    api.form.get('reason')!.setValue('wrong account');
    api.confirm();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const arg = dialogRef.close.mock.calls[0][0] as { reason: string; reversalDate: string };
    expect(arg.reason).toBe('wrong account');
    expect(arg.reversalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
