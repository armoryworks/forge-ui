import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, Subject } from 'rxjs';

import { EdiPanelComponent } from './edi-panel.component';
import { EdiService } from '../../services/edi.service';
import { EdiTradingPartner } from '../../models/edi-trading-partner.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  deletePartner(partner: EdiTradingPartner): void;
}

describe('EdiPanelComponent deletePartner', () => {
  let dialogResult: Subject<boolean>;
  let deleteTradingPartner: ReturnType<typeof vi.fn>;
  let component: PanelInternals;
  const partner = { id: 9, name: 'Acme Supply' } as EdiTradingPartner;

  beforeEach(() => {
    TestBed.resetTestingModule();
    dialogResult = new Subject<boolean>();
    deleteTradingPartner = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: EdiService, useValue: { getTradingPartners: () => of([]), deleteTradingPartner } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => dialogResult })) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new EdiPanelComponent()) as unknown as PanelInternals;
  });

  it('asks before deleting and does nothing when the admin cancels', () => {
    component.deletePartner(partner);
    dialogResult.next(false);

    expect(TestBed.inject(MatDialog).open).toHaveBeenCalled();
    expect(deleteTradingPartner).not.toHaveBeenCalled();
  });

  it('deletes the partner once confirmed', () => {
    component.deletePartner(partner);
    dialogResult.next(true);

    expect(deleteTradingPartner).toHaveBeenCalledWith(9);
  });
});

interface PartnerFormInternals {
  partnerForm: EdiPanelComponent['partnerForm'];
  openCreatePartner(): void;
  openEditPartner(partner: EdiTradingPartner): void;
  savePartner(): void;
}

describe('EdiPanelComponent partner customer link', () => {
  let createTradingPartner: ReturnType<typeof vi.fn>;
  let updateTradingPartner: ReturnType<typeof vi.fn>;
  let component: PartnerFormInternals;

  beforeEach(() => {
    TestBed.resetTestingModule();
    createTradingPartner = vi.fn(() => of({}));
    updateTradingPartner = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: EdiService, useValue: { getTradingPartners: () => of([]), createTradingPartner, updateTradingPartner } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new EdiPanelComponent()) as unknown as PartnerFormInternals;
  });

  it('sends the picked customer when creating a partner', () => {
    component.openCreatePartner();
    component.partnerForm.patchValue({ name: 'Big Box Retail', qualifierValue: 'BIGBOX', customerId: 42 });

    component.savePartner();

    expect(createTradingPartner).toHaveBeenCalledWith(expect.objectContaining({ name: 'Big Box Retail', customerId: 42 }));
  });

  it('loads the linked customer when editing and PUTs a changed one', () => {
    component.openEditPartner({
      id: 5, name: 'Big Box Retail', customerId: 42, customerName: 'Big Box', qualifierId: 'ZZ', qualifierValue: 'BIGBOX',
      defaultFormat: 'X12', transportMethod: 'Manual', autoProcess: true, requireAcknowledgment: true, notes: null,
    } as EdiTradingPartner);
    expect(component.partnerForm.controls.customerId.value).toBe(42);

    component.partnerForm.controls.customerId.setValue(77);
    component.savePartner();

    expect(updateTradingPartner).toHaveBeenCalledWith(5, expect.objectContaining({ customerId: 77 }));
  });
});
