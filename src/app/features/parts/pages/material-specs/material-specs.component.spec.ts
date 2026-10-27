import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { MaterialSpec } from '../../models/material-spec.model';
import { MaterialSpecService } from '../../services/material-spec.service';
import { MaterialSpecsPageComponent } from './material-specs.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PageInternals {
  specs(): MaterialSpec[];
  showRetired: { setValue(value: boolean): void };
  openCreate(): void;
  openRename(spec: MaterialSpec): void;
  setActive(spec: MaterialSpec, active: boolean): void;
}

function spec(id: number, label: string, parentId: number | null = null, isActive = true): MaterialSpec {
  return {
    id, code: label.toLowerCase(), label, parentId, categoryLabel: parentId ? 'Aluminum' : null,
    sortOrder: 10, isActive, isSeedData: false, partCount: 0,
  };
}

describe('MaterialSpecsPageComponent', () => {
  let list: ReturnType<typeof vi.fn>;
  let retire: ReturnType<typeof vi.fn>;
  let reactivate: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let snackbar: { success: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    list = vi.fn(() => of([spec(1, 'Aluminum'), spec(2, '6061-T6', 1)]));
    retire = vi.fn(() => of(spec(2, '6061-T6', 1, false)));
    reactivate = vi.fn(() => of(spec(2, '6061-T6', 1)));
    open = vi.fn(() => ({ afterClosed: () => of(null) }));
    snackbar = { success: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MaterialSpecService, useValue: { list, retire, reactivate } },
        { provide: MatDialog, useValue: { open } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
  });

  function create(): PageInternals {
    return TestBed.runInInjectionContext(() => new MaterialSpecsPageComponent()) as unknown as PageInternals;
  }

  it('lists the active specs on open and the retired ones on request', () => {
    const page = create();

    expect(list).toHaveBeenCalledWith(false);
    expect(page.specs().map(s => s.label)).toEqual(['Aluminum', '6061-T6']);

    page.showRetired.setValue(true);

    expect(list).toHaveBeenLastCalledWith(true);
  });

  it('creates a spec through the material dialog with the current list and reloads after a create', () => {
    open.mockReturnValue({ afterClosed: () => of({ id: 3 }) });
    const page = create();

    page.openCreate();

    const [, config] = open.mock.calls[0] as [unknown, { data: { items: { id: number; parentId: number | null }[] } }];
    expect(config.data.items.map(i => [i.id, i.parentId])).toEqual([[1, null], [2, 1]]);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('renames through the rename dialog and reloads when it saves', () => {
    open.mockReturnValue({ afterClosed: () => of(spec(2, '6061-T651', 1)) });
    const page = create();

    page.openRename(spec(2, '6061-T6', 1));

    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { spec: spec(2, '6061-T6', 1) } }));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('retires and reactivates a spec', () => {
    const page = create();

    page.setActive(spec(2, '6061-T6', 1), false);
    expect(retire).toHaveBeenCalledWith(2);
    page.setActive(spec(2, '6061-T6', 1, false), true);
    expect(reactivate).toHaveBeenCalledWith(2);
    expect(snackbar.success).toHaveBeenCalledTimes(2);
  });

  it('reports a refused retire', () => {
    retire.mockReturnValue(throwError(() => new Error('409')));
    const page = create();

    page.setActive(spec(1, 'Aluminum'), false);

    expect(snackbar.errorFrom).toHaveBeenCalledWith(expect.anything(), 'parts.materialSpecsPage.retireFailed');
  });
});
