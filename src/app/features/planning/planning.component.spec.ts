import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { BacklogService } from '../backlog/services/backlog.service';
import { PlanningComponent } from './planning.component';
import { PlanningService } from './services/planning.service';

interface PlanningApi {
  selectedCycle: { set(value: unknown): void } & (() => unknown);
  onCycleDialogSaved(request: unknown): void;
  activateCycle(): void;
}

const detail = { id: 7, name: 'Week 43', status: 'Planning', entries: [] };

function setup(confirmed: boolean) {
  const planning = {
    createCycle: vi.fn(() => of({ id: 7, name: 'Week 43', status: 'Planning' })),
    getCycles: vi.fn(() => of([{ id: 7, name: 'Week 43', status: 'Planning' }])),
    getCycle: vi.fn(() => of(detail)),
    activateCycle: vi.fn(() => of(undefined)),
  };
  const open = vi.fn(() => ({ afterClosed: () => of(confirmed) }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: PlanningService, useValue: planning },
      { provide: BacklogService, useValue: { getJobs: () => of([]) } },
      { provide: MatDialog, useValue: { open } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
      { provide: DraftResumeService, useValue: { consume: () => false } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new PlanningComponent()) as unknown as PlanningApi;
  return { page, planning, open };
}

describe('PlanningComponent', () => {
  it('opens the full new cycle after creating it', () => {
    const { page, planning } = setup(true);

    page.onCycleDialogSaved({ name: 'Week 43' });

    expect(planning.getCycle).toHaveBeenCalledWith(7);
    expect(page.selectedCycle()).toEqual(detail);
  });

  it('asks before activating a cycle', () => {
    const { page, planning, open } = setup(false);
    page.selectedCycle.set(detail);

    page.activateCycle();

    expect(open).toHaveBeenCalledTimes(1);
    expect(planning.activateCycle).not.toHaveBeenCalled();
  });

  it('activates once confirmed', () => {
    const { page, planning } = setup(true);
    page.selectedCycle.set(detail);

    page.activateCycle();

    expect(planning.activateCycle).toHaveBeenCalledWith(7);
  });
});
