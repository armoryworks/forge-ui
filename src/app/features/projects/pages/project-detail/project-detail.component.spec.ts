import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ProjectDetailComponent } from './project-detail.component';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project.model';
import { ProjectJob } from '../../models/project-job.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DetailApi {
  project(): Project | null;
  jobs(): ProjectJob[];
  wbsRows(): { code: string; depth: number }[];
  deliverablesEnabled(): boolean;
  canDelete: boolean;
  statusControl: { setValue(v: string): void };
  changeStatus(): void;
  unlinkJob(job: ProjectJob): void;
  linkJob(): void;
}

const JOB = { jobId: 3, jobNumber: 'J-3', wbsElementId: 11 } as ProjectJob;

describe('ProjectDetailComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let deliverablesOn: boolean;
  let roles: string[];
  let dialogOpen: ReturnType<typeof vi.fn>;

  function setup(): DetailApi {
    service = {
      get: vi.fn(() => of({ id: 2, projectNumber: 'PRJ-0002', name: 'Line', status: 'Planning', customerId: 4 })),
      summary: vi.fn(() => of({
        projectId: 2, budgetTotal: 100, actualTotal: 40, committedTotal: 0, estimateAtCompletion: 100, varianceAtCompletion: 0, percentComplete: 40,
        wbsTree: [{ id: 10, code: '1', name: 'Phase', children: [{ id: 11, code: '1.1', name: 'Fixtures', children: [] }] }],
      })),
      earnedValue: vi.fn(() => of({ costPerformanceIndex: 1, schedulePerformanceIndex: 1 })),
      jobs: vi.fn(() => of([JOB])),
      update: vi.fn(() => of({ id: 2, status: 'Active' })),
      unlinkJob: vi.fn(() => of(undefined)),
    };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(true) }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '2' }) } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-O2C-DELIVERABLE' && deliverablesOn } },
      ],
    });
    return TestBed.runInInjectionContext(() => new ProjectDetailComponent()) as unknown as DetailApi;
  }

  beforeEach(() => {
    deliverablesOn = true;
    roles = ['PM'];
  });

  it('loads the project, its work breakdown as an indented tree and its linked jobs', () => {
    const detail = setup();

    expect(detail.project()?.projectNumber).toBe('PRJ-0002');
    expect(detail.wbsRows().map(r => [r.code, r.depth])).toEqual([['1', 0], ['1.1', 1]]);
    expect(detail.jobs()).toEqual([JOB]);
  });

  it('saves a status change', () => {
    const detail = setup();

    detail.statusControl.setValue('Active');
    detail.changeStatus();

    expect(service['update']).toHaveBeenCalledWith(2, { status: 'Active' });
  });

  it('links a job to a work breakdown element and unlinks it', () => {
    const detail = setup();

    detail.linkJob();
    expect(dialogOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: { projectId: 2, elements: [expect.objectContaining({ id: 10 }), expect.objectContaining({ id: 11 })] },
    }));

    detail.unlinkJob(JOB);
    expect(service['unlinkJob']).toHaveBeenCalledWith(2, 11, 3);
    expect(detail.jobs()).toEqual([]);
  });

  it('hides the deliverables tab when deliverables are off, and delete from a PM', () => {
    deliverablesOn = false;
    const detail = setup();

    expect(detail.deliverablesEnabled()).toBe(false);
    expect(detail.canDelete).toBe(false);
  });
});
