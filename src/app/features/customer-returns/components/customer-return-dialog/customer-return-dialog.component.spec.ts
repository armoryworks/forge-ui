import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { CustomerReturnService } from '../../services/customer-return.service';
import { CustomerReturnDetail } from '../../models/customer-return-detail.model';
import { CustomerReturnDialogComponent } from './customer-return-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type DialogInternals = {
  returnForm: FormGroup;
  dialogRef: { clearDraft(): void };
  save(): void;
  jobFilters(): Record<string, string>;
};

describe('CustomerReturnDialogComponent quantity', () => {
  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    create = vi.fn(() => of({ id: 3 } as CustomerReturnDetail));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: CustomerReturnService, useValue: { create, update: vi.fn() } },
      ],
    });
  });

  function dialog(): DialogInternals {
    const d = TestBed.runInInjectionContext(() => new CustomerReturnDialogComponent()) as unknown as DialogInternals;
    d.dialogRef = { clearDraft: () => undefined };
    return d;
  }

  it('lets the original job picker reach archived jobs', () => {
    expect(dialog().jobFilters()['includeArchived']).toBe('true');
  });

  it('requires a positive quantity on a new return', () => {
    const d = dialog();
    d.returnForm.patchValue({ customerId: 1, originalJobId: 2, reason: 'Cracked', returnDate: new Date(2026, 9, 1) });
    expect(d.returnForm.valid).toBe(false);
    d.returnForm.patchValue({ quantity: 0 });
    expect(d.returnForm.valid).toBe(false);
    d.returnForm.patchValue({ quantity: 2 });
    expect(d.returnForm.valid).toBe(true);
  });

  it('sends the returned quantity when the return is created', () => {
    const d = dialog();
    d.returnForm.patchValue({ customerId: 1, originalJobId: 2, reason: 'Cracked', quantity: 2.5, returnDate: new Date(2026, 9, 1) });

    d.save();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 1, originalJobId: 2, quantity: 2.5 }));
  });

  it('asks for a rework work order only when the toggle is on', () => {
    const d = dialog();
    d.returnForm.patchValue({ customerId: 1, originalJobId: 2, reason: 'Cracked', quantity: 3, returnDate: new Date(2026, 9, 1) });
    d.save();
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ createReworkJob: false }));

    d.returnForm.patchValue({ createReworkJob: true });
    d.save();
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ createReworkJob: true, quantity: 3 }));
  });
});
