import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { BudgetsComponent } from './budgets.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { AccountingHubService } from '../../../../shared/services/accounting-hub.service';

interface BudgetsInternals {
  form: () => FormGroup;
  save(): void;
}

function setup(upsertBudget: ReturnType<typeof vi.fn>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: GeneralLedgerService,
        useValue: {
          getChartOfAccounts: () => of([{ id: 40, accountType: 'Expense', accountNumber: '6000', name: 'Rent' }]),
          listBudgets: () => of([]),
          upsertBudget,
          deleteBudget: vi.fn(() => of(null)),
        },
      },
      { provide: AccountingHubService, useValue: { subscribe: () => () => undefined } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(convertToParamMap({ year: '2026' })) } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new BudgetsComponent()) as unknown as BudgetsInternals;
  TestBed.flushEffects();
  view.form().get('40')!.setValue(1200);
  return view;
}

describe('BudgetsComponent · save', () => {
  it('sends one save when Save is pressed twice before the server answers', () => {
    const upsertBudget = vi.fn(() => new Subject());
    const view = setup(upsertBudget);

    view.save();
    view.save();

    expect(upsertBudget).toHaveBeenCalledTimes(1);
  });

  it('lets Save be pressed again after the server rejects the first save', () => {
    const upsertBudget = vi.fn(() => throwError(() => new Error('500')));
    const view = setup(upsertBudget);

    view.save();
    view.save();

    expect(upsertBudget).toHaveBeenCalledTimes(2);
  });
});
