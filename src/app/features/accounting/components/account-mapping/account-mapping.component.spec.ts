import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SelectOption } from '../../../../shared/components/select/select.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { AccountMappingComponent } from './account-mapping.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { GlAccountAdmin } from '../../models/accounting.models';
import { DeterminationRule } from '../../models/determination-rule.model';

interface MappingInternals {
  rows(): { key: string; options: SelectOption[]; control: FormControl<number | null> | null; rule: DeterminationRule }[];
  save(row: unknown): void;
}

const account = (id: number, accountNumber: string, accountType: string, extra: Partial<GlAccountAdmin> = {}): GlAccountAdmin => ({
  id, accountNumber, name: `Account ${accountNumber}`, accountType, normalBalance: 'Credit', parentAccountId: null,
  isPostable: true, isControlAccount: false, isActive: true, requiresJob: false, requiresCostCenter: false,
  cashFlowCategory: null, description: null, hasPostings: false, ...extra,
});

describe('AccountMappingComponent', () => {
  const rules: DeterminationRule[] = [
    { key: 'AR_CONTROL', glAccountId: 1, accountNumber: '11000', accountName: 'AR', configurable: false, requiredAccountType: null },
    { key: 'FREIGHT_INCOME', glAccountId: 2, accountNumber: '40500', accountName: 'Freight Income', configurable: true, requiredAccountType: 'Income' },
  ];
  let gl: { getDeterminationRules: ReturnType<typeof vi.fn>; updateDeterminationRule: ReturnType<typeof vi.fn> };
  let mapping: MappingInternals;

  beforeEach(() => {
    gl = {
      getDeterminationRules: vi.fn(() => of(rules)),
      updateDeterminationRule: vi.fn(() => of({ ...rules[1], glAccountId: 3, accountNumber: '40600', accountName: 'Delivery' })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: GeneralLedgerService, useValue: gl },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(AccountMappingComponent);
    fixture.componentRef.setInput('bookId', 1);
    fixture.componentRef.setInput('accounts', [
      account(1, '11000', 'Asset', { isControlAccount: true }),
      account(2, '40500', 'Income'),
      account(3, '40600', 'Income'),
      account(4, '40700', 'Income', { isActive: false }),
      account(5, '60000', 'Expense'),
    ]);
    fixture.detectChanges();
    mapping = fixture.componentInstance as unknown as MappingInternals;
  });

  it('offers only active, postable, non-control accounts of the key\'s type, and no picker for system keys', () => {
    const [ar, freight] = mapping.rows();
    expect(ar.control).toBeNull();
    expect(freight.options.map(o => o.value)).toEqual([2, 3]);
    expect(freight.control?.value).toBe(2);
  });

  it('saves a changed mapping and shows the new account', () => {
    const freight = mapping.rows()[1];
    freight.control!.setValue(3);

    mapping.save(freight);

    expect(gl.updateDeterminationRule).toHaveBeenCalledWith('FREIGHT_INCOME', 3);
    expect(mapping.rows()[1].rule.accountNumber).toBe('40600');
  });

  it('does not save an unchanged mapping', () => {
    mapping.save(mapping.rows()[1]);
    expect(gl.updateDeterminationRule).not.toHaveBeenCalled();
  });
});
