import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PartWhereUsed, PartWhereUsedRow } from '../../models/part-where-used.model';
import { PartWhereUsedService } from '../../services/part-where-used.service';
import { PartWhereUsedComponent } from './part-where-used.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function usage(parentPartNumber: string, level: number, path: string[], bomLineId = 1): PartWhereUsed {
  return {
    bomLineId, parentPartId: level * 10, parentPartNumber, parentName: parentPartNumber, parentRevision: 'A',
    quantityPer: 1, sourceType: 'Make', openWorkOrderCount: 0, level, path,
  };
}

describe('PartWhereUsedComponent', () => {
  let response: PartWhereUsed[];

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartWhereUsedService, useValue: { getWhereUsed: () => of(response) } },
      ],
    });
  });

  it('keeps the indented server order and keys each row by its path, so a shared assembly can appear twice', () => {
    response = [
      usage('SA-051', 1, ['PRT-50', 'SA-051'], 1),
      usage('FG-053', 2, ['PRT-50', 'SA-051', 'FG-053'], 7),
      usage('SA-052', 1, ['PRT-50', 'SA-052'], 2),
      usage('FG-053', 2, ['PRT-50', 'SA-052', 'FG-053'], 7),
    ];
    const component = TestBed.runInInjectionContext(() => new PartWhereUsedComponent());
    mockSignalInputs(component, { partId: 50 });
    TestBed.tick();

    const rows = (component as unknown as { rows(): PartWhereUsedRow[] }).rows();
    expect(rows.map(r => [r.parentPartNumber, r.level])).toEqual([['SA-051', 1], ['FG-053', 2], ['SA-052', 1], ['FG-053', 2]]);
    expect(new Set(rows.map(r => r.rowKey)).size).toBe(4);
  });
});
