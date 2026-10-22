import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { WorkflowRun } from '../../models/workflow-run.model';
import { WorkflowService } from '../../services/workflow.service';
import { WorkflowActiveListDialogComponent } from './workflow-active-list-dialog.component';

function buildRun(overrides: Partial<WorkflowRun>): WorkflowRun {
  return {
    id: 5, entityType: 'Customer', entityId: 3, definitionId: 'customer-guided-v1',
    currentStepId: 'addresses', mode: 'guided', startedAt: '', startedByUserId: 1,
    completedAt: null, abandonedAt: null, abandonedReason: null,
    lastActivityAt: '', version: 1, draftPayload: null,
    ...overrides,
  };
}

describe('WorkflowActiveListDialogComponent resume', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn().mockResolvedValue(true);
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: WorkflowService, useValue: { listActive: () => of([]) } },
      ],
    });
  });

  function resume(run: WorkflowRun): void {
    const component = TestBed.runInInjectionContext(() => new WorkflowActiveListDialogComponent());
    (component as unknown as { resume(r: WorkflowRun): void }).resume(run);
  }

  it('sends a bound customer run to the customer workflow page, not the customer detail', () => {
    resume(buildRun({}));

    expect(navigate).toHaveBeenCalledWith(['/customers/new'], {
      queryParams: { runId: 5, workflow: 'customer-guided-v1', mode: 'guided' },
    });
    expect(close).toHaveBeenCalledWith({ resumed: 5 });
  });

  it('sends an unsaved run to the new-record workflow page', () => {
    resume(buildRun({ entityType: 'Vendor', entityId: null, definitionId: 'vendor-guided-v1' }));

    expect(navigate).toHaveBeenCalledWith(['/vendors/new'], {
      queryParams: { runId: 5, workflow: 'vendor-guided-v1', mode: 'guided' },
    });
  });

  it('sends a bound part run to the part with its run id', () => {
    resume(buildRun({ entityType: 'Part', entityId: 9, definitionId: 'part-make-component-v1', mode: 'express' }));

    expect(navigate).toHaveBeenCalledWith(['/parts/9'], {
      queryParams: { runId: 5, workflow: 'part-make-component-v1', mode: 'express' },
    });
  });
});
