import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ReportBuilderComponent } from './report-builder.component';
import { ReportBuilderService } from '../../services/report-builder.service';
import { ReportEntityDefinition } from '../../models/report-builder.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ReportSchedulesDialogComponent } from '../report-schedules-dialog/report-schedules-dialog.component';

interface BuilderInternals {
  entityControl: FormControl<string>;
  editingReport: { set(report: { id: number; name: string } | null): void };
  runBlockers(): string[];
  deleteSelectedReport(): void;
  canRun(): boolean;
  selectedEntity(): ReportEntityDefinition | null;
  toggleColumn(field: string): void;
  runReport(): void;
  runError(): boolean;
  reportResults(): unknown;
  canSchedule(): boolean;
  openSchedules(): void;
}

describe('ReportBuilderComponent', () => {
  let builder: BuilderInternals;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let deleteReport: ReturnType<typeof vi.fn>;
  let runReport: ReturnType<typeof vi.fn>;
  let roles: string[];

  const jobs = { entitySource: 'Jobs', label: 'Jobs', fields: [{ field: 'jobNumber', label: 'Job #' }] } as unknown as ReportEntityDefinition;

  beforeEach(() => {
    dialogOpen = vi.fn();
    deleteReport = vi.fn(() => of(undefined));
    runReport = vi.fn();
    roles = ['Admin'];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ReportBuilderService,
          useValue: {
            entities: signal([jobs]),
            savedReports: signal([]),
            loadEntities: vi.fn(),
            loadSavedReports: vi.fn(),
            deleteReport,
            runReport,
          },
        },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: AuthService, useValue: { hasRole: (role: string) => roles.includes(role) } },
      ],
    });
    builder = TestBed.runInInjectionContext(() => new ReportBuilderComponent()) as unknown as BuilderInternals;
  });

  it('enables Run and Save once an entity and a column are picked', () => {
    expect(builder.canRun()).toBe(false);

    builder.entityControl.setValue('Jobs');
    builder.toggleColumn('jobNumber');

    expect(builder.selectedEntity()).toBe(jobs);
    expect(builder.canRun()).toBe(true);
  });

  it('says why Run and Save are disabled', () => {
    expect(builder.runBlockers()).toEqual(['reports.chooseDataSourceFirst']);

    builder.entityControl.setValue('Jobs');
    expect(builder.runBlockers()).toEqual(['reports.pickColumnFirst']);

    builder.toggleColumn('jobNumber');
    expect(builder.runBlockers()).toEqual([]);
  });

  it('asks before deleting a saved report and keeps it on cancel', () => {
    dialogOpen.mockReturnValue({ afterClosed: () => of(false) });
    builder.editingReport.set({ id: 3, name: 'Probe' });

    builder.deleteSelectedReport();

    expect(dialogOpen).toHaveBeenCalled();
    expect(deleteReport).not.toHaveBeenCalled();
  });

  it('deletes the saved report once confirmed', () => {
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    builder.editingReport.set({ id: 3, name: 'Probe' });

    builder.deleteSelectedReport();

    expect(deleteReport).toHaveBeenCalledWith(3);
  });

  it('replaces old results with an error state when a run fails', () => {
    builder.entityControl.setValue('Jobs');
    builder.toggleColumn('jobNumber');
    runReport.mockReturnValueOnce(of({ rows: [{ jobNumber: 'J-1' }], totalCount: 1 }));
    builder.runReport();
    expect(builder.reportResults()).not.toBeNull();

    runReport.mockReturnValueOnce(throwError(() => new Error('500')));
    builder.runReport();

    expect(builder.reportResults()).toBeNull();
    expect(builder.runError()).toBe(true);
  });

  it('opens the schedules for the saved report', () => {
    builder.editingReport.set({ id: 3, name: 'Weekly jobs' });

    builder.openSchedules();

    expect(builder.canSchedule()).toBe(true);
    expect(dialogOpen).toHaveBeenCalledWith(ReportSchedulesDialogComponent, expect.objectContaining({
      data: { reportId: 3, reportName: 'Weekly jobs' },
    }));
  });

  it('hides scheduling from roles the schedules API refuses', () => {
    roles = ['PM'];

    expect(builder.canSchedule()).toBe(false);
  });
});
