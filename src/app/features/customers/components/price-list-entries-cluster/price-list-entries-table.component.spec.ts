import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { PriceListEntriesTableComponent } from './price-list-entries-table.component';
import { PriceListEntry } from '../../models/price-list.model';
import { PriceListsService } from '../../services/price-lists.service';

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

interface InlineEditAccess {
  startEdit(row: PriceListEntry, field: 'unitPrice' | 'minQuantity'): void;
  commitEdit(row: PriceListEntry, field: 'unitPrice' | 'minQuantity', value: number): void;
  cancelEdit(): void;
  isEditing(row: PriceListEntry, field: 'unitPrice' | 'minQuantity'): boolean;
  isSaving(row: PriceListEntry, field: 'unitPrice' | 'minQuantity'): boolean;
  getCellError(row: PriceListEntry, field: 'unitPrice' | 'minQuantity'): string | null;
  readValue(target: EventTarget | null): number;
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

  // --- Inline-cell edit (Pattern D) ---

  describe('inline-cell edit', () => {
    it('startEdit flips the cell into edit state for the targeted (entry, field)', () => {
      const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
      mockSignalInputs(component, {
        priceListId: 100,
        entries: [makeEntry({ id: 11 })],
        loading: false,
      });
      const c = component as unknown as InlineEditAccess;
      const row = makeEntry({ id: 11 });

      expect(c.isEditing(row, 'unitPrice')).toBe(false);
      c.startEdit(row, 'unitPrice');
      expect(c.isEditing(row, 'unitPrice')).toBe(true);
      // Other field on same row is NOT in edit.
      expect(c.isEditing(row, 'minQuantity')).toBe(false);
    });

    it('commitEdit calls updateEntry, emits cellSaved, and clears edit state on success', async () => {
      const updated = makeEntry({ id: 11, unitPrice: 25 });
      const updateEntry = vi.fn().mockReturnValue(of(updated));
      TestBed.overrideProvider(PriceListsService, {
        useValue: { updateEntry },
      });
      const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
      mockSignalInputs(component, {
        priceListId: 100,
        entries: [makeEntry({ id: 11, unitPrice: 12.5 })],
        loading: false,
      });
      const cellSavedCb = vi.fn();
      component.cellSaved.subscribe(cellSavedCb);

      const c = component as unknown as InlineEditAccess;
      const row = makeEntry({ id: 11, unitPrice: 12.5 });

      c.startEdit(row, 'unitPrice');
      c.commitEdit(row, 'unitPrice', 25);

      expect(updateEntry).toHaveBeenCalledWith(11, {
        unitPrice: 25,
        minQuantity: 1,
        currency: 'USD',
        notes: null,
      });
      expect(cellSavedCb).toHaveBeenCalledWith(updated);
      expect(c.isEditing(row, 'unitPrice')).toBe(false);
      expect(c.isSaving(row, 'unitPrice')).toBe(false);
      expect(c.getCellError(row, 'unitPrice')).toBeNull();
    });

    it('commitEdit short-circuits when the value is unchanged (no service call)', () => {
      const updateEntry = vi.fn();
      TestBed.overrideProvider(PriceListsService, {
        useValue: { updateEntry },
      });
      const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
      mockSignalInputs(component, {
        priceListId: 100,
        entries: [makeEntry({ id: 11, unitPrice: 12.5 })],
        loading: false,
      });

      const c = component as unknown as InlineEditAccess;
      const row = makeEntry({ id: 11, unitPrice: 12.5 });
      c.startEdit(row, 'unitPrice');
      c.commitEdit(row, 'unitPrice', 12.5);

      expect(updateEntry).not.toHaveBeenCalled();
      expect(c.isEditing(row, 'unitPrice')).toBe(false);
    });

    it('cancelEdit reverts to read state without calling the service', () => {
      const updateEntry = vi.fn();
      TestBed.overrideProvider(PriceListsService, {
        useValue: { updateEntry },
      });
      const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
      mockSignalInputs(component, {
        priceListId: 100,
        entries: [makeEntry({ id: 11 })],
        loading: false,
      });

      const c = component as unknown as InlineEditAccess;
      const row = makeEntry({ id: 11 });
      c.startEdit(row, 'unitPrice');
      c.cancelEdit();

      expect(updateEntry).not.toHaveBeenCalled();
      expect(c.isEditing(row, 'unitPrice')).toBe(false);
    });

    it('commitEdit on save error keeps the cell in edit state and stamps an error message', () => {
      const updateEntry = vi.fn().mockReturnValue(
        throwError(() => ({ error: { detail: 'Server says no' } })),
      );
      TestBed.overrideProvider(PriceListsService, {
        useValue: { updateEntry },
      });
      const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
      mockSignalInputs(component, {
        priceListId: 100,
        entries: [makeEntry({ id: 11, unitPrice: 12.5 })],
        loading: false,
      });
      const cellSavedCb = vi.fn();
      component.cellSaved.subscribe(cellSavedCb);

      const c = component as unknown as InlineEditAccess;
      const row = makeEntry({ id: 11, unitPrice: 12.5 });
      c.startEdit(row, 'unitPrice');
      c.commitEdit(row, 'unitPrice', 25);

      expect(updateEntry).toHaveBeenCalledTimes(1);
      expect(cellSavedCb).not.toHaveBeenCalled();
      expect(c.isEditing(row, 'unitPrice')).toBe(true);
      expect(c.isSaving(row, 'unitPrice')).toBe(false);
      expect(c.getCellError(row, 'unitPrice')).toBe('Server says no');
    });

    it('commitEdit guards against invalid values locally (minQuantity < 1)', () => {
      const updateEntry = vi.fn();
      TestBed.overrideProvider(PriceListsService, {
        useValue: { updateEntry },
      });
      const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
      mockSignalInputs(component, {
        priceListId: 100,
        entries: [makeEntry({ id: 11, minQuantity: 5 })],
        loading: false,
      });

      const c = component as unknown as InlineEditAccess;
      const row = makeEntry({ id: 11, minQuantity: 5 });
      c.startEdit(row, 'minQuantity');
      c.commitEdit(row, 'minQuantity', 0);

      expect(updateEntry).not.toHaveBeenCalled();
      // Cell stays open with an error indicator.
      expect(c.isEditing(row, 'minQuantity')).toBe(true);
      expect(c.getCellError(row, 'minQuantity')).toBeTruthy();
    });

    it('commitEdit treats NaN (empty input) as cancel', () => {
      const updateEntry = vi.fn();
      TestBed.overrideProvider(PriceListsService, {
        useValue: { updateEntry },
      });
      const component = TestBed.runInInjectionContext(() => new PriceListEntriesTableComponent());
      mockSignalInputs(component, {
        priceListId: 100,
        entries: [makeEntry({ id: 11 })],
        loading: false,
      });

      const c = component as unknown as InlineEditAccess;
      const row = makeEntry({ id: 11 });
      c.startEdit(row, 'unitPrice');
      c.commitEdit(row, 'unitPrice', NaN);

      expect(updateEntry).not.toHaveBeenCalled();
      expect(c.isEditing(row, 'unitPrice')).toBe(false);
    });
  });
});
