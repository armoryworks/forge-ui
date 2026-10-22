import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { EntityPickerComponent } from './entity-picker.component';

type Row = Record<string, unknown>;

describe('EntityPickerComponent excludeIds', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: MatDialog, useValue: { open: vi.fn() } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function search(excludeIds: unknown[] | null): Row[] {
    const picker = TestBed.runInInjectionContext(() => new EntityPickerComponent());
    mockSignalInputs(picker, {
      label: 'Part', entityType: 'parts', filters: {},
      ...(excludeIds ? { excludeIds } : {}),
    });
    let rows: Row[] = [];
    (picker as unknown as { search(term: string): Observable<Row[]> }).search('np').subscribe(r => (rows = r));
    http.expectOne(req => req.url === '/api/v1/parts').flush({ items: [{ id: 663, partNumber: 'NP-1' }, { id: 664, partNumber: 'NP-2' }] });
    return rows;
  }

  it('leaves the excluded ids out of the results', () => {
    expect(search([663]).map(r => r['id'])).toEqual([664]);
  });

  it('returns every result by default', () => {
    expect(search(null).map(r => r['id'])).toEqual([663, 664]);
  });
});
