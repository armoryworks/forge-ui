import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PpapListComponent } from './ppap-list.component';
import { PpapService } from '../../services/ppap.service';
import { PpapSubmission } from '../../models/ppap-submission.model';
import { AuthService } from '../../../../../shared/services/auth.service';

interface ListApi {
  canAuthor: boolean;
  submissions(): PpapSubmission[];
  statusFilter: { setValue(v: string | null): void };
  load(): void;
  open(row: unknown): void;
  openCreate(): void;
}

function setup(roles: string[]) {
  const list = vi.fn(() => of([{ id: 3, submissionNumber: 'PPAP-0003' } as PpapSubmission]));
  const navigate = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: PpapService, useValue: { list } },
      { provide: Router, useValue: { navigate } },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of({ id: 8 }) })) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  return { page: TestBed.runInInjectionContext(() => new PpapListComponent()) as unknown as ListApi, list, navigate };
}

describe('PpapListComponent', () => {
  it('loads submissions, filters by status and opens one', () => {
    const { page, list, navigate } = setup(['Engineer']);
    expect(page.submissions()).toHaveLength(1);

    page.statusFilter.setValue('Submitted');
    page.load();
    page.open(page.submissions()[0]);

    expect(list).toHaveBeenLastCalledWith({ status: 'Submitted' });
    expect(navigate).toHaveBeenCalledWith(['/quality/ppap', 3]);
  });

  it('opens a new submission after creating it', () => {
    const { page, navigate } = setup(['Manager']);

    page.openCreate();

    expect(navigate).toHaveBeenCalledWith(['/quality/ppap', 8]);
  });

  it('does not offer New PPAP outside the author roles', () => {
    expect(setup(['OfficeManager']).page.canAuthor).toBe(false);
  });
});
