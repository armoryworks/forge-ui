import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { CapabilityService } from '../../../shared/services/capability.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MaterialIssue } from '../models/job-cost.model';
import { JobCostService } from '../services/job-cost.service';
import { JobCostTabComponent } from './job-cost-tab.component';

function issue(overrides: Partial<MaterialIssue> = {}): MaterialIssue {
  return {
    id: 2, jobId: 5, partId: 3, partNumber: 'RS-1', partDescription: '', operationId: null, operationName: null,
    quantity: 55, unitCost: 1, totalCost: 55, issuedByName: '', issuedAt: '2026-10-17T00:00:00Z', lotNumber: 'R-26-117',
    issueType: 'Issue', notes: null, isReturned: false, ...overrides,
  };
}

function setup(capabilityOn = true) {
  const pending = new Subject<MaterialIssue>();
  const returnMaterial = vi.fn(() => pending.asObservable());
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: JobCostService, useValue: { returnMaterial } },
      { provide: CapabilityService, useValue: { isEnabled: vi.fn((code: string) => capabilityOn && code === 'CAP-MFG-MATL-ISSUE') } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new JobCostTabComponent());
  return { component, returnMaterial, pending };
}

describe('JobCostTabComponent', () => {
  it('offers Return only for issues that have not been returned', () => {
    const { component } = setup();

    expect(component.canReturn(issue())).toBe(true);
    expect(component.canReturn(issue({ isReturned: true }))).toBe(false);
    expect(component.canReturn(issue({ issueType: 'Return' }))).toBe(false);
  });

  it('sends one return while the first is still in flight', () => {
    const { component, returnMaterial } = setup();

    component.returnMaterial(issue());
    component.returnMaterial(issue());

    expect(returnMaterial).toHaveBeenCalledTimes(1);
    expect(component.returningId()).toBe(2);
  });

  it('allows another return after a refused one', () => {
    const { component, returnMaterial, pending } = setup();
    component.returnMaterial(issue());

    pending.error(new Error('already returned'));
    component.returnMaterial(issue({ id: 3 }));

    expect(returnMaterial).toHaveBeenCalledTimes(2);
  });

  it('shows the issue action only with material issue turned on', () => {
    expect(setup(true).component.canIssue()).toBe(true);
    expect(setup(false).component.canIssue()).toBe(false);
  });
});
