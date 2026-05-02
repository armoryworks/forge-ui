import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PriceListEntriesTableComponent } from './price-list-entries-table.component';
import { PriceListEntry } from '../../models/price-list.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function makeEntry(overrides: Partial<PriceListEntry> = {}): PriceListEntry {
  return {
    id: 1, priceListId: 100, partId: 50,
    partNumber: 'WIDGET-001', partName: 'Standard widget',
    unitPrice: 12.5, minQuantity: 1, currency: 'USD', notes: null,
    createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('PriceListEntriesTableComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PriceListEntriesTableComponent],
      providers: [
        provideHttpClient(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
  });

  it('exposes the documented column set in the canonical order', () => {
    const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
    mockSignalInputs(component, {
      priceListId: 100,
      entries: [] as PriceListEntry[],
      loading: false,
    });
    const c = component as unknown as { columns: { field: string }[] };
    const fields = c.columns.map(col => col.field);
    expect(fields).toEqual([
      'partNumber', 'partName', 'minQuantity', 'unitPrice',
      'currency', 'notes', 'actions',
    ]);
  });

  it('emits add when onAdd is invoked', () => {
    const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
    mockSignalInputs(component, {
      priceListId: 100,
      entries: [] as PriceListEntry[],
      loading: false,
    });
    const cb = vi.fn();
    component.add.subscribe(cb);
    const c = component as unknown as { onAdd(): void };
    c.onAdd();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('emits edit with the row when onEdit is invoked', () => {
    const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
    mockSignalInputs(component, {
      priceListId: 100,
      entries: [makeEntry({ id: 7 })],
      loading: false,
    });
    const cb = vi.fn();
    component.edit.subscribe(cb);
    const row = makeEntry({ id: 7 });
    const c = component as unknown as { onEdit(r: PriceListEntry): void };
    c.onEdit(row);
    expect(cb).toHaveBeenCalledWith(row);
  });

  it('emits delete with the row when onDelete is invoked', () => {
    const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
    mockSignalInputs(component, {
      priceListId: 100,
      entries: [makeEntry({ id: 9 })],
      loading: false,
    });
    const cb = vi.fn();
    component.delete.subscribe(cb);
    const row = makeEntry({ id: 9 });
    const c = component as unknown as { onDelete(r: PriceListEntry): void };
    c.onDelete(row);
    expect(cb).toHaveBeenCalledWith(row);
  });
});
