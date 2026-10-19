import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, Subject } from 'rxjs';

import { WorkflowRun } from '../models/workflow-run.model';
import { SnackbarService } from './snackbar.service';
import { WorkflowResumeService } from './workflow-resume.service';
import { WorkflowService } from './workflow.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function buildRun(id: number, lastActivityAt: string): WorkflowRun {
  return {
    id, entityType: 'Customer', entityId: 3, definitionId: 'customer-guided-v1',
    currentStepId: 'addresses', mode: 'guided', startedAt: '', startedByUserId: 1,
    completedAt: null, abandonedAt: null, abandonedReason: null,
    lastActivityAt, version: 1, draftPayload: null,
  };
}

describe('WorkflowResumeService', () => {
  let listActive: ReturnType<typeof vi.fn>;
  let infoWithAction: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let action: Subject<void>;

  beforeEach(() => {
    listActive = vi.fn();
    action = new Subject<void>();
    infoWithAction = vi.fn().mockReturnValue(action);
    dialogOpen = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: WorkflowService, useValue: { listActive } },
        { provide: SnackbarService, useValue: { infoWithAction } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    });
  });

  it('offers to resume recent runs and opens the list only when asked', async () => {
    const now = new Date().toISOString();
    listActive.mockReturnValue(of([buildRun(1, now), buildRun(2, now)]));
    const service = TestBed.inject(WorkflowResumeService);

    await service.checkAfterLogin();

    expect(infoWithAction).toHaveBeenCalledWith('workflow.shell.resume.promptOther', 'workflow.shell.resume.resumeButton');
    expect(dialogOpen).not.toHaveBeenCalled();
    action.next();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('uses the singular prompt for one run', async () => {
    listActive.mockReturnValue(of([buildRun(1, new Date().toISOString())]));

    await TestBed.inject(WorkflowResumeService).checkAfterLogin();

    expect(infoWithAction).toHaveBeenCalledWith('workflow.shell.resume.promptOne', 'workflow.shell.resume.resumeButton');
  });

  it('stays quiet when every run is older than a day', async () => {
    listActive.mockReturnValue(of([buildRun(1, '2020-01-01T00:00:00Z')]));

    await TestBed.inject(WorkflowResumeService).checkAfterLogin();

    expect(infoWithAction).not.toHaveBeenCalled();
  });

  it('prompts once per session until reset on logout', async () => {
    listActive.mockReturnValue(of([buildRun(1, new Date().toISOString())]));
    const service = TestBed.inject(WorkflowResumeService);

    await service.checkAfterLogin();
    await service.checkAfterLogin();
    expect(listActive).toHaveBeenCalledTimes(1);

    service.reset();
    await service.checkAfterLogin();
    expect(listActive).toHaveBeenCalledTimes(2);
  });
});
