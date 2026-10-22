import { describe, it, expect, vi } from 'vitest';
import { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { PartImportPageComponent } from './part-import.component';
import { PartsService } from '../../services/parts.service';
import { BulkPartIntakeResponse } from '../../models/bulk-part-intake.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

describe('PartImportPageComponent · commit', () => {
  it('commits the batch once when Commit is pressed twice before the server answers', () => {
    const bulkIntakeCommit = vi.fn(() => new Subject());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PartsService, useValue: { bulkIntakeCommit } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const view = TestBed.runInInjectionContext(() => new PartImportPageComponent()) as unknown as {
      preview: WritableSignal<BulkPartIntakeResponse | null>;
      commit(): void;
    };
    view.preview.set({ totalRows: 1, createdCount: 1, skippedCount: 0, results: [] });

    view.commit();
    view.commit();

    expect(bulkIntakeCommit).toHaveBeenCalledTimes(1);
  });
});
