import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { ReportBuilderComponent } from './report-builder.component';
import { ReportBuilderService } from '../../services/report-builder.service';
import { ReportEntityDefinition } from '../../models/report-builder.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface BuilderInternals {
  entityControl: FormControl<string>;
  canRun(): boolean;
  selectedEntity(): ReportEntityDefinition | null;
  toggleColumn(field: string): void;
}

describe('ReportBuilderComponent', () => {
  let builder: BuilderInternals;

  const jobs = { entitySource: 'Jobs', label: 'Jobs', fields: [{ field: 'jobNumber', label: 'Job #' }] } as unknown as ReportEntityDefinition;

  beforeEach(() => {
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
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
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
});
