import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { DisplayLabelService } from './display-label.service';
import { TermSetStore } from '../terminology/term-set.store';

describe('DisplayLabelService', () => {
  let service: DisplayLabelService;
  let translate: TranslateService;
  let store: TermSetStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    service = TestBed.inject(DisplayLabelService);
    translate = TestBed.inject(TranslateService);
    store = TestBed.inject(TermSetStore);
    translate.setTranslation('en', {
      status: { inProgress: 'In Progress' },
      enums: { creditRisk: { onHold: 'On hold (credit)' } },
      roles: { officeManager: 'Office manager' },
      common: { yes: 'Yes', no: 'No' },
    });
    translate.use('en');
  });

  it('uses the shared status catalog for a known value', () => {
    expect(service.enumLabel('InProgress')).toBe('In Progress');
  });

  it('prefers a grouped catalog entry over the shared status one', () => {
    expect(service.enumLabel('OnHold', 'creditRisk')).toBe('On hold (credit)');
  });

  it('humanizes a value with no catalog entry instead of showing it raw', () => {
    expect(service.enumLabel('PartiallyReceived')).toBe('Partially received');
    expect(service.enumLabel('QcHold')).toBe('QC hold');
  });

  it('applies a per-install status override first', () => {
    store.setEntries([{ key: 'status_in_progress', label: 'Running' }]);
    expect(service.enumLabel('InProgress')).toBe('Running');
  });

  it('labels roles from the catalog, an override, or the humanized name', () => {
    expect(service.roleLabel('OfficeManager')).toBe('Office manager');
    expect(service.roleLabel('ProductionWorker')).toBe('Production worker');
    store.setEntries([{ key: 'role_production_worker', label: 'Operator' }]);
    expect(service.roleLabel('ProductionWorker')).toBe('Operator');
  });

  it('returns an empty string for missing values', () => {
    expect(service.enumLabel(null)).toBe('');
    expect(service.roleLabel(undefined)).toBe('');
  });

  it('labels booleans as yes and no', () => {
    expect(service.booleanLabel(true)).toBe('Yes');
    expect(service.booleanLabel(false)).toBe('No');
  });
});

describe('DisplayLabelService without a translate service', () => {
  it('still humanizes values', () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(DisplayLabelService);
    expect(service.enumLabel('OutOfControl')).toBe('Out of control');
    expect(service.booleanLabel(false)).toBe('No');
  });
});
