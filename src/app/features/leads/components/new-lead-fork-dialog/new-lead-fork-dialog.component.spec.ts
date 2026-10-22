import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { NewLeadForkDialogComponent } from './new-lead-fork-dialog.component';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AccountsService } from '../../services/accounts.service';

describe('NewLeadForkDialogComponent · create', () => {
  function setup() {
    const close = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: ReferenceDataService, useValue: { getAsOptions: () => of([]) } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: AccountsService, useValue: { list: () => of([]) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const view = TestBed.runInInjectionContext(() => new NewLeadForkDialogComponent()) as unknown as {
      form: FormGroup;
      create(): void;
      submitted: () => boolean;
    };
    return { view, close };
  }

  it('hands back one lead when Create is pressed twice', () => {
    const { view, close } = setup();
    view.form.patchValue({ companyName: 'Acme' });

    view.create();
    view.create();

    expect(close).toHaveBeenCalledTimes(1);
    expect(view.submitted()).toBe(true);
  });

  it('does not lock Create when the form is still invalid', () => {
    const { view, close } = setup();

    view.create();
    view.form.patchValue({ companyName: 'Acme' });
    view.create();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
