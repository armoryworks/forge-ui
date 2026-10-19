import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { LotService } from '../../services/lot.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LotDialogComponent } from './lot-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  lotForm: FormGroup;
  save: () => void;
}

describe('LotDialogComponent', () => {
  const create = vi.fn((_body: Record<string, unknown>) => of({ id: 1 }));

  function setup(): DialogInternals {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: LotService, useValue: { create } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new LotDialogComponent());
    Object.defineProperty(component, 'dialogRef', { value: { clearDraft: vi.fn() } });
    return component as unknown as DialogInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('sends the lot number the user typed, trimmed', () => {
    const dialog = setup();
    dialog.lotForm.patchValue({ partId: 4, quantity: 30, lotNumber: '  H-55821 ' });

    dialog.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ partId: 4, quantity: 30, lotNumber: 'H-55821' }));
  });

  it('leaves the lot number to the server when it is blank', () => {
    const dialog = setup();
    dialog.lotForm.patchValue({ partId: 4, quantity: 30, lotNumber: '   ' });

    dialog.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ lotNumber: null }));
  });
});
