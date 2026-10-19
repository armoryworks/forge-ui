import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { PieceRatesComponent } from './piece-rates.component';
import { PieceRatesService } from './services/piece-rates.service';
import { PieceWorkEntry } from './models/piece-rate.model';
import { SnackbarService } from '../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PieceRatesInternals {
  workForm: FormGroup;
  logWork(): void;
  deleteWork(entry: PieceWorkEntry): void;
}

const ENTRY: PieceWorkEntry = {
  id: 2, userId: 7, userName: 'Kelly, Ben', partId: 3, partNumber: 'FG-320', operationId: null,
  workDate: '2026-10-19', quantity: 2.5, rateSnapshot: 0.125, earnings: 0.31, notes: null,
};

function setup(confirm: boolean) {
  const service = {
    getRates: vi.fn().mockReturnValue(of([])),
    getUsers: vi.fn().mockReturnValue(of([])),
    getWork: vi.fn().mockReturnValue(of([])),
    getCompliance: vi.fn().mockReturnValue(of(null)),
    logWork: vi.fn().mockReturnValue(of(ENTRY)),
    deleteWork: vi.fn().mockReturnValue(of(undefined)),
  };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(confirm) })) };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: PieceRatesService, useValue: service },
      { provide: SnackbarService, useValue: snackbar },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  vi.spyOn(translate, 'instant').mockImplementation((key: string | string[], params?: object) =>
    `${String(key)}${params ? ' ' + JSON.stringify(params) : ''}`);
  const component = TestBed.runInInjectionContext(() => new PieceRatesComponent()) as unknown as PieceRatesInternals;
  return { component, service, snackbar, dialog };
}

describe('PieceRatesComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('deletes a pay record only after the confirm', () => {
    const declined = setup(false);
    declined.component.deleteWork(ENTRY);
    expect(declined.dialog.open).toHaveBeenCalled();
    expect(declined.service.deleteWork).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const confirmed = setup(true);
    confirmed.component.deleteWork(ENTRY);
    expect(confirmed.service.deleteWork).toHaveBeenCalledWith(2);
  });

  it('reports earnings as money and leaves the pieces field untouched after logging', () => {
    const { component, snackbar } = setup(true);
    component.workForm.setValue({ userId: 7, partId: 3, date: new Date(2026, 9, 19), quantity: 2.5 });
    component.workForm.controls['quantity'].markAsTouched();

    component.logWork();

    expect(snackbar.success.mock.calls[0][0]).toContain('$0.31');
    const quantity = component.workForm.controls['quantity'];
    expect(quantity.value).toBeNull();
    expect(quantity.touched).toBe(false);
  });
});
