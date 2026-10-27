import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AiService } from '../../../shared/services/ai.service';
import { AiIndexEntityStatus, AiIndexStatus } from '../../../shared/models/ai-index-status.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AiIndexComponent } from './ai-index.component';

const STATUS: AiIndexStatus = {
  entityTypes: [
    { entityType: 'Job', indexedCount: 2, totalCount: 5, chunkCount: 9, lastIndexedAt: '2026-10-27T09:00:00Z' },
    { entityType: 'Documentation', indexedCount: 40, totalCount: null, chunkCount: 120, lastIndexedAt: null },
  ],
  totalChunks: 129,
  lastIndexedAt: '2026-10-27T09:00:00Z',
};

interface Internals {
  status(): AiIndexStatus | null;
  progress(): { done: number; total: number } | null;
  busy(): boolean;
  indexType(row: AiIndexEntityStatus): void;
  reindexAll(): void;
}

function setup() {
  const ai = {
    indexStatus: vi.fn(() => of(STATUS)),
    bulkIndex: vi.fn(() => of({ totalChunksIndexed: 4 })),
  };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AiService, useValue: ai },
      { provide: SnackbarService, useValue: snackbar },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new AiIndexComponent()) as unknown as Internals;
  return { component, ai, snackbar };
}

describe('AiIndexComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the index status', () => {
    const { component, ai } = setup();

    expect(ai.indexStatus).toHaveBeenCalled();
    expect(component.status()).toEqual(STATUS);
  });

  it('re-indexes one record type', () => {
    const { component, ai } = setup();

    component.indexType(STATUS.entityTypes[0]);

    expect(ai.bulkIndex).toHaveBeenCalledWith('Job');
    expect(ai.indexStatus).toHaveBeenCalledTimes(2);
    expect(component.busy()).toBe(false);
  });

  it('re-indexes every type in turn and reports the total', () => {
    const { component, ai, snackbar } = setup();

    component.reindexAll();

    expect(ai.bulkIndex.mock.calls.map(c => (c as unknown[])[0])).toEqual(['Job', 'Documentation']);
    expect(snackbar.success).toHaveBeenCalledWith('aiIndexAdmin.allIndexed');
    expect(component.progress()).toBeNull();
  });
});
