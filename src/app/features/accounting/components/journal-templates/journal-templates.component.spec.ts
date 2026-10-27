import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { JournalTemplate } from '../../models/journal-template.model';
import { JournalTemplatesComponent } from './journal-templates.component';

type Internals = {
  ngOnInit(): void;
  rows(): { id: number; lineCount: number; fixedDebit: number; openLines: number }[];
  post(t: JournalTemplate): void;
  edit(t: JournalTemplate): void;
  remove(t: JournalTemplate): void;
};

const base = `${environment.apiUrl}/accounting/journal-templates`;
const RENT: JournalTemplate = {
  id: 3, bookId: 1, name: 'Rent', description: null, memo: 'Rent', autoReverseNextPeriod: false, isActive: true,
  lines: [
    { accountDeterminationKey: null, glAccountId: 610, debit: 1200, credit: 0, description: null, partyType: null, partyId: null },
    { accountDeterminationKey: 'CASH', glAccountId: null, debit: 0, credit: 1200, description: null, partyType: null, partyId: null },
  ],
};
const ACCRUAL: JournalTemplate = {
  ...RENT, id: 4, name: 'Utilities accrual', isActive: false,
  lines: RENT.lines.map((l) => ({ ...l, debit: 0, credit: 0 })),
};

describe('JournalTemplatesComponent', () => {
  let http: HttpTestingController;
  const router = { navigate: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(): Internals {
    const c = TestBed.runInInjectionContext(() => new JournalTemplatesComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne(`${base}?bookId=1`).flush([RENT, ACCRUAL]);
    return c;
  }

  it('lists templates with their fixed amounts and open lines', () => {
    const c = create();

    expect(c.rows().map((r) => [r.id, r.lineCount, r.fixedDebit, r.openLines])).toEqual([[3, 2, 1200, 0], [4, 2, 0, 2]]);
  });

  it('posts through the journal-entry editor pre-filled from the template', () => {
    const c = create();

    c.post(RENT);

    expect(router.navigate).toHaveBeenCalledWith(['/accounting/journal-entries/new'], { queryParams: { fromTemplate: 3 } });
  });

  it('does not post from an inactive template', () => {
    const c = create();

    c.post(ACCRUAL);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens the editor for a template', () => {
    const c = create();

    c.edit(RENT);

    expect(router.navigate).toHaveBeenCalledWith(['/accounting/journal-templates', 3]);
  });

  it('deletes after confirmation and reloads', () => {
    const c = create();
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    c.remove(RENT);

    const req = http.expectOne(`${base}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.expectOne(`${base}?bookId=1`).flush([ACCRUAL]);
    expect(c.rows().map((r) => r.id)).toEqual([4]);
  });

  it('keeps the template when the confirmation is declined', () => {
    const c = create();
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    c.remove(RENT);

    http.expectNone(`${base}/3`);
  });
});
