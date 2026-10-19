import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ReportBuilderComponent } from './report-builder.component';
import { ReportBuilderService } from '../../services/report-builder.service';
import { ReportEntityDefinition } from '../../models/report-builder.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface BuilderInternals {
  entityControl: FormControl<string>;
  editingReport: { set(report: { id: number; name: string } | null): void };
  runBlockers(): string[];
  deleteSelectedReport(): void;
  canRun(): boolean;
  selectedEntity(): ReportEntityDefinition | null;
  toggleColumn(field: string): void;
}

describe('ReportBuilderComponent', () => {
  let builder: BuilderInternals;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let deleteReport: ReturnType<typeof vi.fn>;

  const jobs = { entitySource: 'Jobs', label: 'Jobs', fields: [{ field: 'jobNumber', label: 'Job #' }] } as unknown as ReportEntityDefinition;

  beforeEach(() => {
    dialogOpen = vi.fn();
    deleteReport = vi.fn(() => of(undefined));
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
          },
        },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
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
});
