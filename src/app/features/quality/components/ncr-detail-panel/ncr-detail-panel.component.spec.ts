import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { NcrDetailPanelComponent } from './ncr-detail-panel.component';
import { NcrCapaService } from '../../services/ncr-capa.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { NonConformance } from '../../models/non-conformance.model';
import { NcrStatus } from '../../models/ncr-status.model';

interface PanelView {
  ncr: Signal<NonConformance | null>;
  canContain: Signal<boolean>;
  canDisposition: Signal<boolean>;
  costsEditable: Signal<boolean>;
  canCloseOrReopen: boolean;
  statusAction: Signal<'close' | 'reopen' | null>;
  containmentControl: FormControl<string>;
  costForm: FormGroup<{ materialCost: FormControl<number | null>; laborCost: FormControl<number | null> }>;
  reasonControl: FormControl<string>;
  reasonForm: FormGroup;
  changed: { subscribe(fn: () => void): unknown };
  dispositionRequested: { subscribe(fn: (n: NonConformance) => void): unknown };
  load(id: number): void;
  markContained(): void;
  saveCosts(): void;
  requestDisposition(): void;
  openStatusAction(action: 'close' | 'reopen'): void;
  confirmStatusAction(): void;
}

const makeNcr = (status: NcrStatus, extra: Partial<NonConformance> = {}): NonConformance => ({
  id: 9,
  ncrNumber: 'NCR-0009',
  status,
  containmentActions: null,
  materialCost: null,
  laborCost: null,
  ...extra,
} as NonConformance);

describe('NcrDetailPanelComponent', () => {
  let service: {
    getNcr: ReturnType<typeof vi.fn>;
    containNcr: ReturnType<typeof vi.fn>;
    updateNcr: ReturnType<typeof vi.fn>;
    closeNcr: ReturnType<typeof vi.fn>;
    reopenNcr: ReturnType<typeof vi.fn>;
  };
  let current: NonConformance;
  let roles: string[];

  const create = (ncr: NonConformance): PanelView => {
    current = ncr;
    const view = TestBed.runInInjectionContext(() => new NcrDetailPanelComponent()) as unknown as PanelView;
    view.load(ncr.id);
    return view;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    roles = ['Manager'];
    service = {
      getNcr: vi.fn(() => of(current)),
      containNcr: vi.fn(() => of(undefined)),
      updateNcr: vi.fn(() => of(undefined)),
      closeNcr: vi.fn(() => of(undefined)),
      reopenNcr: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: NcrCapaService, useValue: service },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (r: string[]) => r.some(x => roles.includes(x)) } },
      ],
    });
  });

  it('loads the NCR and seeds the containment text and costs', () => {
    const view = create(makeNcr('Open', { containmentActions: 'Tagged', materialCost: 40, laborCost: 12 }));

    expect(service.getNcr).toHaveBeenCalledWith(9);
    expect(view.containmentControl.value).toBe('Tagged');
    expect(view.costForm.getRawValue()).toEqual({ materialCost: 40, laborCost: 12 });
    expect(view.canContain()).toBe(true);
    expect(view.canDisposition()).toBe(true);
  });

  it('marks the NCR contained with the trimmed containment text and reloads it', () => {
    const view = create(makeNcr('Open'));
    const changed = vi.fn();
    view.changed.subscribe(changed);
    view.containmentControl.setValue('  Quarantined the lot  ');

    view.markContained();

    expect(service.containNcr).toHaveBeenCalledWith(9, 'Quarantined the lot');
    expect(changed).toHaveBeenCalled();
    expect(service.getNcr).toHaveBeenCalledTimes(2);
  });

  it('does not contain without containment text', () => {
    const view = create(makeNcr('UnderReview'));
    view.containmentControl.setValue('   ');

    view.markContained();

    expect(service.containNcr).not.toHaveBeenCalled();
  });

  it('only offers containment while Open or Under Review', () => {
    expect(create(makeNcr('Contained')).canContain()).toBe(false);
  });

  it('saves only the cost fields that were entered', () => {
    const view = create(makeNcr('Dispositioned'));
    view.costForm.setValue({ materialCost: 125.5, laborCost: null });

    view.saveCosts();

    expect(service.updateNcr).toHaveBeenCalledWith(9, { materialCost: 125.5, laborCost: undefined });
  });

  it('locks costs once the NCR is Closed', () => {
    const view = create(makeNcr('Closed'));
    view.costForm.setValue({ materialCost: 10, laborCost: 5 });

    view.saveCosts();

    expect(view.costsEditable()).toBe(false);
    expect(service.updateNcr).not.toHaveBeenCalled();
  });

  it('hands the NCR to the disposition dialog', () => {
    const view = create(makeNcr('Contained'));
    const requested = vi.fn();
    view.dispositionRequested.subscribe(requested);

    view.requestDisposition();

    expect(requested).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  it('closes a Dispositioned NCR with an optional reason', () => {
    const view = create(makeNcr('Dispositioned'));
    view.openStatusAction('close');
    expect(view.reasonForm.valid).toBe(true);

    view.confirmStatusAction();

    expect(service.closeNcr).toHaveBeenCalledWith(9, undefined);
    expect(view.statusAction()).toBeNull();
  });

  it('requires a reason to reopen and sends it', () => {
    const view = create(makeNcr('Closed'));
    view.openStatusAction('reopen');
    expect(view.reasonForm.invalid).toBe(true);

    view.confirmStatusAction();
    expect(service.reopenNcr).not.toHaveBeenCalled();

    view.reasonControl.setValue(' Defect recurred ');
    view.confirmStatusAction();

    expect(service.reopenNcr).toHaveBeenCalledWith(9, 'Defect recurred');
  });

  it('reserves close and reopen for Admin and Manager', () => {
    roles = ['Engineer'];
    expect(create(makeNcr('Closed')).canCloseOrReopen).toBe(false);
  });
});
