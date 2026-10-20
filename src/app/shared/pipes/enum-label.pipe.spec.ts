import { TestBed } from '@angular/core/testing';

import { EnumLabelPipe, RoleLabelPipe } from './enum-label.pipe';

describe('EnumLabelPipe and RoleLabelPipe', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [EnumLabelPipe, RoleLabelPipe] });
  });

  it('labels an enum value', () => {
    expect(TestBed.inject(EnumLabelPipe).transform('AwaitingApproval')).toBe('Awaiting approval');
  });

  it('labels a role list as readable names joined by commas', () => {
    expect(TestBed.inject(RoleLabelPipe).transform(['Admin', 'OfficeManager', 'PM'])).toBe('Admin, Office manager, PM');
  });
});
