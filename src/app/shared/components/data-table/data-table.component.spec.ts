import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DataTableComponent } from './data-table.component';
import { ColumnDef } from '../../models/column-def.model';
import { ServerPageRequest, ServerPageState } from '../../models/server-page-state.model';
import { UserPreferencesService } from '../../services/user-preferences.service';

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
});

describe('DataTableComponent · server paging', () => {
  const columns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part', sortable: true },
    { field: 'customer', header: 'Customer', sortable: true, sortField: 'customerName' },
    { field: 'price', header: 'Price' },
  ];
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, partNumber: `P-${String(30 - i).padStart(2, '0')}` }));

  interface TableInternals {
    pagedData(): unknown[];
    paginatorLength(): number;
    hasFilter(field: string): boolean;
    filters: { set(value: Record<string, unknown>): void };
  }

  function create(serverPaging: ServerPageState | null) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: ComponentFixtureAutoDetect, useValue: false },
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('tableId', 'test');
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', rows);
    fixture.componentRef.setInput('serverPaging', serverPaging);
    const table = fixture.componentInstance;
    const requests: ServerPageRequest[] = [];
    table.serverPageChange.subscribe(r => requests.push(r));
    return { table, internals: table as unknown as TableInternals, requests };
  }

  const page: ServerPageState = { pageIndex: 2, pageSize: 25, totalCount: 480, sort: 'partNumber', order: 'asc' };

  it('renders the server page as given and pages against the server total', () => {
    const { internals } = create(page);

    expect(internals.pagedData()).toEqual(rows);
    expect(internals.paginatorLength()).toBe(480);
  });

  it('keeps client paging and sorting when no server state is given', () => {
    const { internals } = create(null);

    expect(internals.pagedData()).toHaveLength(25);
    expect(internals.paginatorLength()).toBe(30);
  });

  it('asks the server for the next page instead of slicing', () => {
    const { table, requests } = create(page);

    table.onPageChange({ pageIndex: 3, pageSize: 25, length: 480 });

    expect(requests).toEqual([{ pageIndex: 3, pageSize: 25, sort: 'partNumber', order: 'asc' }]);
  });

  it('goes back to the first page when the page size changes', () => {
    const { table, requests } = create(page);

    table.onPageChange({ pageIndex: 2, pageSize: 50, length: 480 });

    expect(requests).toEqual([{ pageIndex: 0, pageSize: 50, sort: 'partNumber', order: 'asc' }]);
  });

  it('cycles a header sort through the server using the column sort field', () => {
    const { table, requests } = create({ ...page, sort: null });
    const click = new MouseEvent('click');

    table.onHeaderClick(columns[1], click);

    expect(requests).toEqual([{ pageIndex: 0, pageSize: 25, sort: 'customerName', order: 'asc' }]);
  });

  it('reads the active sort from the server state', () => {
    const { table } = create({ ...page, sort: 'customerName', order: 'desc' });

    expect(table.getSortState('customer')).toEqual({ field: 'customer', direction: 'desc' });
    expect(table.getSortState('partNumber')).toBeUndefined();
  });

  it('turns a descending server sort off on the third click', () => {
    const { table, requests } = create({ ...page, sort: 'partNumber', order: 'desc' });

    table.onHeaderClick(columns[0], new MouseEvent('click'));

    expect(requests).toEqual([{ pageIndex: 0, pageSize: 25, sort: null, order: 'asc' }]);
  });

  it('ignores saved client column filters in server mode', () => {
    const { internals } = create(page);

    internals.filters.set({ partNumber: 'P-01' });

    expect(internals.pagedData()).toEqual(rows);
    expect(internals.hasFilter('partNumber')).toBe(false);
  });
});
