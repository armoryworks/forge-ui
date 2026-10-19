import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { JobDetailDialogComponent, JobDetailDialogData } from './job-detail-dialog.component';
import { KanbanService } from '../services/kanban.service';
import { UserRef } from '../models/user-ref.model';

interface DialogInternals {
  users: () => UserRef[];
}

const PEOPLE = [{ id: 1, name: 'Lena' }, { id: 2, name: 'Ben' }] as UserRef[];

function setup(data: JobDetailDialogData) {
  const kanban = { getUsers: vi.fn().mockReturnValue(of(PEOPLE)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: KanbanService, useValue: kanban },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new JobDetailDialogComponent()) as unknown as DialogInternals;
  return { component, kanban };
}

describe('JobDetailDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the assignable people itself when the opener passes none', () => {
    const { component, kanban } = setup({ jobId: 20 });

    expect(kanban.getUsers).toHaveBeenCalledOnce();
    expect(component.users()).toEqual(PEOPLE);
  });

  it('loads them when the opener passed a list that had not loaded yet', () => {
    const { component } = setup({ jobId: 20, users: [] });

    expect(component.users()).toEqual(PEOPLE);
  });

  it('uses the list the opener passed', () => {
    const { component, kanban } = setup({ jobId: 20, users: [PEOPLE[0]] });

    expect(kanban.getUsers).not.toHaveBeenCalled();
    expect(component.users()).toEqual([PEOPLE[0]]);
  });
});
