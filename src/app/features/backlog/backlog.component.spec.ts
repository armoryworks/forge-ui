import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { BacklogComponent } from './backlog.component';
import { BacklogService } from './services/backlog.service';
import { KanbanService } from '../kanban/services/kanban.service';
import { AuthService } from '../../shared/services/auth.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface ComponentInternals {
  canCreateJobs: () => boolean;
  showJobDialog: () => boolean;
  openCreateDialog(): void;
  jobs: { set(value: unknown[]): void };
  searchControl: { setValue(value: string): void };
  filteredJobs: () => { jobNumber: string }[];
}

describe('BacklogComponent', () => {
  let roles: string[];

  function create(): ComponentInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BacklogService, useValue: { getJobs: vi.fn(() => of([])) } },
        { provide: KanbanService, useValue: { getTrackTypes: vi.fn(() => of([])), getUsers: vi.fn(() => of([])) } },
        { provide: LoadingService, useValue: { track: (_label: string, source: Observable<unknown>) => source } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn() } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})), snapshot: { queryParams: {} } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: DetailDialogService, useValue: { open: vi.fn(), getDetailFromUrl: () => null } },
        { provide: AuthService, useValue: { hasRole: (r: string) => roles.includes(r), hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    return TestBed.runInInjectionContext(() => new BacklogComponent()) as unknown as ComponentInternals;
  }

  beforeEach(() => {
    roles = ['PM'];
  });

  it('offers New Job to the roles that plan work', () => {
    const component = create();

    expect(component.canCreateJobs()).toBe(true);
    component.openCreateDialog();
    expect(component.showJobDialog()).toBe(true);
  });

  it('withholds New Job from production workers', () => {
    roles = ['ProductionWorker'];
    const component = create();

    expect(component.canCreateJobs()).toBe(false);
    component.openCreateDialog();
    expect(component.showJobDialog()).toBe(false);
  });

  it('matches the search without regard to accents or case', () => {
    const component = create();
    component.jobs.set([
      { jobNumber: 'J-1', title: 'Soporte de García' },
      { jobNumber: 'J-2', title: 'Bracket' },
    ]);

    component.searchControl.setValue('GARCIA');

    expect(component.filteredJobs().map(j => j.jobNumber)).toEqual(['J-1']);
  });
});
