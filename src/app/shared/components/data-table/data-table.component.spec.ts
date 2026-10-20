import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { DataTableComponent } from './data-table.component';
import { ColumnDef } from '../../models/column-def.model';
import { UserPreferencesService } from '../../services/user-preferences.service';

class EmptyLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('DataTableComponent · formatCellValue', () => {
  const dateCol: ColumnDef = { field: 'date', header: 'Date', type: 'date' };
  let table: DataTableComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: ComponentFixtureAutoDetect, useValue: false },
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    table = TestBed.createComponent(DataTableComponent).componentInstance;
  });

  it('renders a date-only value as that calendar date', () => {
    expect(table.formatCellValue({ date: '2026-10-07' }, dateCol)).toBe('10/07/2026');
  });

  it('does not shift a first-of-month date-only value into the previous month', () => {
    expect(table.formatCellValue({ date: '2026-03-01' }, dateCol)).toBe('03/01/2026');
  });

  it('renders the UTC midnight the API sends for a date field as that calendar date west of UTC', () => {
    const originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
    try {
      expect(table.formatCellValue({ date: '2026-10-16T00:00:00+00:00' }, dateCol)).toBe('10/16/2026');
    } finally {
      if (originalTz === undefined) delete process.env['TZ'];
      else process.env['TZ'] = originalTz;
    }
  });

  it('keeps the date-time format for timestamps', () => {
    const stamp = new Date(2026, 9, 7, 14, 30);
    expect(table.formatCellValue({ date: stamp.toISOString() }, dateCol)).toBe('10/07/2026 02:30 PM');
  });

  it('leaves empty date cells empty', () => {
    expect(table.formatCellValue({ date: null }, dateCol)).toBeNull();
  });

  it('shows an enum cell by its filter option label', () => {
    const col: ColumnDef = { field: 'severity', header: 'Severity', type: 'enum', filterOptions: [{ value: 'critical', label: 'Critical' }] };
    expect(table.formatCellValue({ severity: 'critical' }, col)).toBe('Critical');
  });

  it('humanizes an enum cell that has no matching option', () => {
    const col: ColumnDef = { field: 'status', header: 'Status', type: 'enum' };
    expect(table.formatCellValue({ status: 'PartiallyReceived' }, col)).toBe('Partially received');
    expect(table.formatCellValue({ status: 'QcHold' }, col)).toBe('QC hold');
  });

  it('shows a boolean cell as yes or no instead of true or false', () => {
    const col: ColumnDef = { field: 'isLowStock', header: 'Low stock' };
    expect(table.formatCellValue({ isLowStock: false }, col)).toBe('No');
    expect(table.formatCellValue({ isLowStock: true }, col)).toBe('Yes');
  });

  it('leaves plain text cells as sent', () => {
    expect(table.formatCellValue({ name: 'InProgress' }, { field: 'name', header: 'Name' })).toBe('InProgress');
  });
});

describe('DataTableComponent · column menu', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: EmptyLoader } }),
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
  });

  it('labels a headerless column menu generically instead of announcing " options"', () => {
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('tableId', 'spec-table');
    fixture.componentRef.setInput('columns', [
      { field: 'name', header: 'Name' },
      { field: 'actions', header: '' },
    ] satisfies ColumnDef[]);
    fixture.componentRef.setInput('data', [{ id: 1, name: 'A' }]);
    fixture.detectChanges();

    const menus = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.data-table__col-menu-btn'));
    expect(menus.length).toBe(2);
    expect(menus.map(m => m.getAttribute('aria-label'))).toEqual(['shared.columnMenu', 'shared.columnMenuUnnamed']);
  });
});

interface TableInternals {
  pageIndex: { set(value: number): void };
  effectivePageIndex: () => number;
  pagedData: () => unknown[];
  sortedData: () => unknown[];
  sortStates: { set(value: { field: string; direction: 'asc' | 'desc' }[]): void };
  filters: { set(value: Record<string, unknown>): void };
  showSelectAllMatching: () => boolean;
  allMatchingSelected: () => boolean;
}

describe('DataTableComponent · behaviour', () => {
  let fixture: ComponentFixture<DataTableComponent>;
  let table: DataTableComponent;
  let internals: TableInternals;

  const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));

  function setup(columns: ColumnDef[], data: unknown[], extra: Record<string, unknown> = {}): void {
    fixture.componentRef.setInput('tableId', 'spec');
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', data);
    for (const [key, value] of Object.entries(extra)) fixture.componentRef.setInput(key, value);
  }

  function sortBy(field: string, direction: 'asc' | 'desc'): unknown[] {
    internals.sortStates.set([{ field, direction }]);
    return internals.sortedData().map(r => (r as { id: unknown }).id);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: ComponentFixtureAutoDetect, useValue: false },
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined, reset: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(DataTableComponent);
    table = fixture.componentInstance;
    internals = table as unknown as TableInternals;
  });

  it('shows the rows when a parent search shrinks the data while on a later page', () => {
    setup([{ field: 'name', header: 'Name' }], rows(60));
    internals.pageIndex.set(1);
    expect(internals.pagedData().length).toBe(25);

    fixture.componentRef.setInput('data', rows(5));

    expect(internals.effectivePageIndex()).toBe(0);
    expect(internals.pagedData().length).toBe(5);
  });

  it('keeps the page when the data changes but the page still exists', () => {
    setup([{ field: 'name', header: 'Name' }], rows(60));
    internals.pageIndex.set(1);

    fixture.componentRef.setInput('data', rows(59));

    expect(internals.effectivePageIndex()).toBe(1);
  });

  it('stays on the first page when the parent data shrinks and then grows back', () => {
    setup([{ field: 'name', header: 'Name' }], rows(60));
    internals.pageIndex.set(2);
    TestBed.tick();

    fixture.componentRef.setInput('data', rows(5));
    TestBed.tick();
    fixture.componentRef.setInput('data', rows(60));
    TestBed.tick();

    expect(internals.effectivePageIndex()).toBe(0);
  });

  it('sorts text with embedded numbers naturally', () => {
    setup([{ field: 'job', header: 'Job', sortable: true }], [
      { id: 'a', job: 'J-10' }, { id: 'b', job: 'J-2' }, { id: 'c', job: 'J-1' },
    ]);

    expect(sortBy('job', 'asc')).toEqual(['c', 'b', 'a']);
  });

  it('puts blank values last whichever way the column is sorted', () => {
    setup([{ field: 'price', header: 'Price', sortable: true, type: 'number' }], [
      { id: 'a', price: null }, { id: 'b', price: 5 }, { id: 'c', price: '' }, { id: 'd', price: 2 }, { id: 'e' },
    ]);

    expect(sortBy('price', 'asc').slice(0, 2)).toEqual(['d', 'b']);
    expect(sortBy('price', 'desc').slice(0, 2)).toEqual(['b', 'd']);
    expect(sortBy('price', 'desc').slice(2).sort()).toEqual(['a', 'c', 'e']);
  });

  it('sorts a number column holding decimal strings by value', () => {
    setup([{ field: 'qty', header: 'Qty', sortable: true, type: 'number' }], [
      { id: 'a', qty: '10' }, { id: 'b', qty: '1.5' }, { id: 'c', qty: '1.25' },
    ]);

    expect(sortBy('qty', 'asc')).toEqual(['c', 'b', 'a']);
  });

  it('matches text filters without regard to accents in either the data or the filter', () => {
    setup([{ field: 'name', header: 'Name' }], [
      { id: 1, name: 'García' }, { id: 2, name: 'Garden' }, { id: 3, name: 'Peña' },
    ]);

    internals.filters.set({ name: 'garcia' });
    expect(internals.sortedData().map(r => (r as { id: number }).id)).toEqual([1]);

    internals.filters.set({ name: { mode: 'equals', value: 'PENA' } });
    expect(internals.sortedData().map(r => (r as { id: number }).id)).toEqual([3]);

    internals.filters.set({ name: { mode: 'startsWith', value: 'garcí' } });
    expect(internals.sortedData().map(r => (r as { id: number }).id)).toEqual([1]);
  });

  it('reports aria-sort only for sortable columns', () => {
    const sortable: ColumnDef = { field: 'name', header: 'Name', sortable: true };
    const plain: ColumnDef = { field: 'other', header: 'Other' };
    setup([sortable, plain], rows(3));

    expect(table.getAriaSort(plain)).toBeNull();
    expect(table.getAriaSort(sortable)).toBe('none');
    internals.sortStates.set([{ field: 'name', direction: 'asc' }]);
    expect(table.getAriaSort(sortable)).toBe('ascending');
    internals.sortStates.set([{ field: 'name', direction: 'desc' }]);
    expect(table.getAriaSort(sortable)).toBe('descending');
  });

  it('opens a clickable row from the keyboard with Enter or Space', () => {
    setup([{ field: 'name', header: 'Name' }], rows(1), { clickableRows: true });
    const clicked: unknown[] = [];
    table.rowClick.subscribe(row => clicked.push(row));
    const tr = document.createElement('tr');
    const key = (k: string, target: EventTarget = tr) => {
      const preventDefault = vi.fn();
      table.onRowKeydown(rows(1)[0], { key: k, target, currentTarget: tr, preventDefault } as unknown as KeyboardEvent);
      return preventDefault;
    };

    key('Enter');
    const spacePrevented = key(' ');
    key('a');

    expect(clicked.length).toBe(2);
    expect(spacePrevented).toHaveBeenCalled();
  });

  it('leaves keys pressed on a control inside the row to that control', () => {
    setup([{ field: 'name', header: 'Name' }], rows(1), { clickableRows: true });
    const clicked: unknown[] = [];
    table.rowClick.subscribe(row => clicked.push(row));
    const tr = document.createElement('tr');
    const button = document.createElement('button');

    table.onRowKeydown(rows(1)[0], { key: 'Enter', target: button, currentTarget: tr, preventDefault: vi.fn() } as unknown as KeyboardEvent);

    expect(clicked.length).toBe(0);
  });

  it('ignores row keys when rows are not clickable', () => {
    setup([{ field: 'name', header: 'Name' }], rows(1));
    const clicked: unknown[] = [];
    table.rowClick.subscribe(row => clicked.push(row));
    const tr = document.createElement('tr');

    table.onRowKeydown(rows(1)[0], { key: 'Enter', target: tr, currentTarget: tr, preventDefault: vi.fn() } as unknown as KeyboardEvent);

    expect(clicked.length).toBe(0);
  });

  it('offers to select every matching row once the whole page is selected', () => {
    setup([{ field: 'name', header: 'Name' }], rows(60), { selectable: true });
    const emitted: unknown[][] = [];
    table.selectionChange.subscribe(sel => emitted.push(sel));

    table.toggleSelectAll();
    expect(emitted.at(-1)!.length).toBe(25);
    expect(internals.showSelectAllMatching()).toBe(true);

    table.selectAllMatching();
    expect(emitted.at(-1)!.length).toBe(60);
    expect(internals.allMatchingSelected()).toBe(true);

    table.clearSelection();
    expect(emitted.at(-1)).toEqual([]);
    expect(internals.showSelectAllMatching()).toBe(false);
  });

  it('selects only the rows the column filters leave visible', () => {
    setup([{ field: 'name', header: 'Name' }], rows(60), { selectable: true });
    const emitted: unknown[][] = [];
    table.selectionChange.subscribe(sel => emitted.push(sel));
    internals.filters.set({ name: 'row 1' });

    table.selectAllMatching();

    expect(emitted.at(-1)!.length).toBe(internals.sortedData().length);
    expect(emitted.at(-1)!.length).toBe(11);
  });

  it('drops rows a new column filter hides from the selection handed to bulk actions', () => {
    setup([{ field: 'name', header: 'Name' }], rows(3), { selectable: true });
    const emitted: unknown[][] = [];
    table.selectionChange.subscribe(sel => emitted.push(sel));
    table.toggleSelectAll();
    expect(emitted.at(-1)!.length).toBe(3);

    table.onFilterApplied({ field: 'name', value: 'row 2' });

    expect(emitted.at(-1)).toEqual([{ id: 2, name: 'Row 2' }]);
  });

  it('drops rows the parent removes from the data from the selection handed to bulk actions', () => {
    setup([{ field: 'name', header: 'Name' }], rows(3), { selectable: true });
    TestBed.tick();
    const emitted: unknown[][] = [];
    table.selectionChange.subscribe(sel => emitted.push(sel));
    table.toggleSelectAll();
    expect(emitted.at(-1)!.length).toBe(3);

    fixture.componentRef.setInput('data', rows(1));
    TestBed.tick();

    expect(emitted.at(-1)).toEqual([{ id: 1, name: 'Row 1' }]);
  });
});
