import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { ScanReturnFlowComponent } from './scan-return-flow.component';

interface ReturnInternals {
  reasonControl: { setValue: (value: string | null) => void };
  reasonLabel: () => string;
}

function setup() {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslateService, useValue: { instant: (key: string) => `es:${key}` } }],
  });
  return TestBed.runInInjectionContext(() => new ScanReturnFlowComponent()) as unknown as ReturnInternals;
}

describe('ScanReturnFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the translated reason on the confirmation step, not the stored code', () => {
    const flow = setup();
    flow.reasonControl.setValue('WrongItem');

    expect(flow.reasonLabel()).toBe('es:shopFloor.returnFlow.reasonWrongItem');
  });

  it('shows nothing before a reason is picked', () => {
    const flow = setup();

    expect(flow.reasonLabel()).toBe('');
  });
});
