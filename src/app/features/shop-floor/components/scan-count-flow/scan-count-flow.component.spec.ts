import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanContext } from '../../../../shared/models/scan-action.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanCountFlowComponent } from './scan-count-flow.component';

const CONTEXT: ScanContext = {
  partId: 5,
  partNumber: 'P-5',
  description: null,
  currentStock: 10,
  currentLocationName: 'A-1',
  currentLocationId: 3,
  availableActions: [],
};

interface CountInternals {
  ngOnInit: () => void;
  confirmCount: () => void;
  submit: () => void;
  countControl: { setValue: (value: number) => void };
}

function setup(count: ScanActionService['count'], context: ScanContext = CONTEXT) {
  const success = vi.fn();
  const error = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { count } },
      { provide: SnackbarService, useValue: { success, error } },
      {
        provide: TranslateService,
        useValue: {
          instant: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : `es:${key}`,
        },
      },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ScanCountFlowComponent());
  mockSignalInputs(component, { context });
  const flow = component as unknown as CountInternals;
  flow.ngOnInit();
  return { flow, success, error };
}

describe('ScanCountFlowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('confirms an unchanged count in the catalog wording', () => {
    const { flow, success } = setup(vi.fn(() => of(0)));
    flow.confirmCount();

    expect(success).toHaveBeenCalledWith('kioskFlows.count.confirmed {"part":"P-5"}');
  });

  it('reports a signed adjustment in the catalog wording', () => {
    const { flow, success } = setup(vi.fn(() => of(0)));
    flow.countControl.setValue(12);
    flow.confirmCount();
    flow.submit();

    expect(success).toHaveBeenCalledWith('kioskFlows.count.adjusted {"part":"P-5","difference":"+2"}');
  });

  it('translates the failure and missing location messages', () => {
    const failing = setup(vi.fn(() => throwError(() => new Error('500'))));
    failing.flow.confirmCount();
    expect(failing.error).toHaveBeenCalledWith('es:kioskFlows.count.failed');

    TestBed.resetTestingModule();
    const unplaced = setup(vi.fn(), { ...CONTEXT, currentLocationId: null });
    unplaced.flow.confirmCount();
    expect(unplaced.error).toHaveBeenCalledWith('es:kioskFlows.count.noLocation');
  });
});
