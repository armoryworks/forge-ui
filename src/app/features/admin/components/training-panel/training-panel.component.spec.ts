import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, Subject } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { TrainingPanelComponent, TrainingModuleRow, TrainingPathRow } from './training-panel.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DetailDialogService } from '../../../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';
import { TrainingService } from '../../../training/services/training.service';
import { AuthService } from '../../../../shared/services/auth.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  ngOnInit(): void;
  modules: { (): TrainingModuleRow[] };
  moduleTotal: { (): number };
  paths: { (): TrainingPathRow[] };
  moduleSearchControl: FormControl<string | null>;
  deleteModule(module: TrainingModuleRow): void;
  isAdmin(): boolean;
}

const base = `${environment.apiUrl}/training`;

function row(id: number): TrainingModuleRow {
  return { id, title: `Module ${id}`, contentType: 'Article', estimatedMinutes: 5, isPublished: true, appRoutes: [], tags: [] };
}

describe('TrainingPanelComponent', () => {
  let httpMock: HttpTestingController;
  let component: PanelInternals;
  let dialogResult: Subject<boolean>;
  let undo: Subject<void>;
  let roles: string[] = ['Admin'];
  let snackbar: { success: ReturnType<typeof vi.fn>; successWithAction: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };

  function modulesRequest(page: number): TestRequest {
    return httpMock.expectOne(r => r.url === `${base}/modules` && r.params.get('page') === String(page));
  }

  function flushSideLoads(paths: unknown[] = []): void {
    httpMock.expectOne(`${base}/paths`).flush(paths);
    httpMock.expectOne(`${base}/admin/progress-summary`).flush([]);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    dialogResult = new Subject<boolean>();
    undo = new Subject<void>();
    snackbar = { success: vi.fn(), successWithAction: vi.fn(() => undo), errorFrom: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => dialogResult })) } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null } },
        { provide: DraftResumeService, useValue: { consume: () => false } },
        { provide: TrainingService, useValue: {} },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    component = TestBed.runInInjectionContext(() => new TrainingPanelComponent()) as unknown as PanelInternals;
  });

  afterEach(() => httpMock.verify());

  it('pages through every module instead of stopping at the server page cap, and counts from totalCount', () => {
    component.ngOnInit();
    flushSideLoads();

    modulesRequest(1).flush({ data: [row(1), row(2)], totalCount: 3, totalPages: 2 });
    modulesRequest(2).flush({ data: [row(3)], totalCount: 3, totalPages: 2 });

    expect(component.modules().map(m => m.id)).toEqual([1, 2, 3]);
    expect(component.moduleTotal()).toBe(3);
  });

  it('sends the search box text to the server', async () => {
    vi.useFakeTimers();
    try {
      component.ngOnInit();
      flushSideLoads();
      modulesRequest(1).flush({ data: [row(1)], totalCount: 1, totalPages: 1 });

      component.moduleSearchControl.setValue('safety');
      vi.advanceTimersByTime(300);

      const req = modulesRequest(1);
      expect(req.request.params.get('search')).toBe('safety');
      req.flush({ data: [], totalCount: 0, totalPages: 0 });
      expect(component.moduleTotal()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('derives each path module count from its modules array', () => {
    component.ngOnInit();
    flushSideLoads([{ id: 7, title: 'Onboarding', icon: 'school', isAutoAssigned: true, isActive: true, modules: [{}, {}, {}] }]);
    modulesRequest(1).flush({ data: [], totalCount: 0, totalPages: 0 });

    expect(component.paths()[0].moduleCount).toBe(3);
  });

  it('does not delete a module until the admin confirms', () => {
    component.deleteModule(row(4));
    dialogResult.next(false);

    httpMock.expectNone(`${base}/modules/4`);
  });

  it('deletes after confirmation and restores the module when the admin clicks Undo', () => {
    component.deleteModule(row(4));
    dialogResult.next(true);

    httpMock.expectOne(r => r.method === 'DELETE' && r.url === `${base}/modules/4`).flush(null);
    modulesRequest(1).flush({ data: [], totalCount: 0, totalPages: 0 });

    undo.next();
    httpMock.expectOne(r => r.method === 'POST' && r.url === `${base}/modules/4/restore`).flush(null);
    modulesRequest(1).flush({ data: [row(4)], totalCount: 1, totalPages: 1 });

    expect(component.modules().map(m => m.id)).toEqual([4]);
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('keeps each path\'s modules in their position order for the edit dialog', () => {
    component.ngOnInit();
    flushSideLoads([{ id: 7, title: 'Onboarding', icon: 'school', isAutoAssigned: false, isActive: true,
      modules: [{ moduleId: 30, position: 2 }, { moduleId: 10, position: 1 }] }]);
    modulesRequest(1).flush({ data: [], totalCount: 0, totalPages: 0 });

    expect(component.paths()[0].moduleIds).toEqual([10, 30]);
  });

  it('treats only an Admin as able to change paths', () => {
    expect(component.isAdmin()).toBe(true);
    roles = ['Manager'];
    const managerView = TestBed.runInInjectionContext(() => new TrainingPanelComponent()) as unknown as PanelInternals;
    expect(managerView.isAdmin()).toBe(false);
    roles = ['Admin'];
  });
});
