import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, TemplateRef, viewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TestBed, ComponentFixture, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader, TranslateService, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';

import { DataTableComponent } from './data-table.component';
import { ColumnDef } from '../../models/column-def.model';
import { ServerPageRequest, ServerPageState } from '../../models/server-page-state.model';
import { UserPreferencesService } from '../../services/user-preferences.service';

class EmptyLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

class CatalogLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({ shared: { selectAllRows: 'Select all rows', selectRow: 'Select row' } });
  }
}

describe('DataTableComponent · formatCellValue', () => {
  const dateCol: ColumnDef = { field: 'date', header: 'Date', type: 'date' };
  let table: DataTableComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: ComponentFixtureAutoDetect, useValue: false },
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    table = TestBed.createComponent(DataTableComponent).componentInstance;
  });

  it('shows an enum cell by its filter option label and leaves unknown values as they are', () => {
    const bucketCol: ColumnDef = {
      field: 'bucket', header: 'Bucket', type: 'enum',
      filterOptions: [{ value: '1-30 Days', label: '1-30 días' }],
    };
    expect(table.formatCellValue({ bucket: '1-30 Days' }, bucketCol)).toBe('1-30 días');
    expect(table.formatCellValue({ bucket: 'Later' }, bucketCol)).toBe('Later');
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

  it('filters a currency column by a min/max range like a number column', () => {
    setup([{ field: 'amount', header: 'Amount', type: 'currency' }], [
      { id: 1, amount: 50 }, { id: 2, amount: 150 }, { id: 3, amount: 1200.5 },
    ]);

    internals.filters.set({ amount: { min: 100, max: 1000 } });

    expect(internals.sortedData().map(r => (r as { id: number }).id)).toEqual([2]);
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

@Component({
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <ng-template #amount let-row><span class="amt">{{ row.amount | currency }}</span><span class="sr-only">dollars</span></ng-template>
    <ng-template #icon let-row>@if (row.active) {<span class="material-icons-outlined">check</span>}</ng-template>
  `,
})
class ExportTemplatesHostComponent {
  readonly amount = viewChild.required<TemplateRef<unknown>>('amount');
  readonly icon = viewChild.required<TemplateRef<unknown>>('icon');
}

describe('DataTableComponent · exports', () => {
  let table: DataTableComponent;
  let templates: Record<string, TemplateRef<unknown>>;
  let captured: Blob | null;

  const columns: ColumnDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'amount', header: 'Amount', type: 'number' },
    { field: 'status', header: 'Status', type: 'enum', filterOptions: [{ value: 'PastDue', label: 'Past due' }] },
    { field: 'dueDate', header: 'Due Date', type: 'date' },
    { field: 'active', header: 'Active' },
    { field: 'isSystem', header: '' },
    { field: 'note', header: 'Note' },
    { field: 'actions', header: 'Actions' },
  ];

  const useTable = (rows: unknown[], cols: ColumnDef[] = columns): void => {
    Object.defineProperty(table, 'tableId', { value: () => 'spec-table' });
    Object.defineProperty(table, 'sortedData', { value: () => rows });
    Object.defineProperty(table, 'visibleColumns', { value: () => cols });
    table.getCellTemplate = (field: string) => templates[field] ?? null;
  };

  const exportedCsv = async (): Promise<{ bytes: Uint8Array; lines: string[] }> => {
    table.exportCsv();
    expect(captured).not.toBeNull();
    const bytes = new Uint8Array(await captured!.arrayBuffer());
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    return { bytes, lines: text.replace(/^\uFEFF/, '').split('\r\n') };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: ComponentFixtureAutoDetect, useValue: false },
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    TestBed.inject(TranslateService).setTranslation('en', { common: { yes: 'Yes', no: 'No' } });
    TestBed.inject(TranslateService).use('en');
    const host = TestBed.createComponent(ExportTemplatesHostComponent);
    host.detectChanges();
    templates = { amount: host.componentInstance.amount(), active: host.componentInstance.icon() };
    table = TestBed.createComponent(DataTableComponent).componentInstance;
    captured = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { captured = blob as Blob; return 'blob:test'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts the CSV with a UTF-8 byte order mark', async () => {
    useTable([{ name: 'Café', amount: 1, active: true }]);
    const { bytes } = await exportedCsv();
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('writes rows in the on-screen sort order', async () => {
    useTable([{ name: 'Zulu' }, { name: 'Alpha' }]);
    const { lines } = await exportedCsv();
    expect(lines[1].startsWith('Zulu')).toBe(true);
    expect(lines[2].startsWith('Alpha')).toBe(true);
  });

  it('writes display text: templated currency, enum label, local date, Yes/No', async () => {
    useTable([{ name: 'A', amount: 5952.375, status: 'PastDue', dueDate: '2026-10-07', active: false, isSystem: true }]);
    const { lines } = await exportedCsv();
    expect(lines[0]).toBe('Name,Amount,Status,Due Date,Active,isSystem,Note');
    expect(lines[1]).toBe('A,"$5,952.38",Past due,10/07/2026,No,Yes,');
  });

  it('drops the actions column but keeps blank-header data columns under their field name', async () => {
    useTable([{ name: 'A', isSystem: false }]);
    const { lines } = await exportedCsv();
    expect(lines[0].split(',')).not.toContain('Actions');
    expect(lines[0].split(',')).toContain('isSystem');
  });

  it('falls back to Yes/No when an icon-only template renders no text', async () => {
    useTable([{ name: 'A', active: true }]);
    const { lines } = await exportedCsv();
    expect(lines[1].split(',')[4]).toBe('Yes');
  });

  it('leaves out columns marked not exportable and uses exportValue over the template', async () => {
    useTable([{ name: 'A', amount: 3 }], [
      { field: 'name', header: 'Name', exportable: false },
      { field: 'amount', header: 'Amount', exportValue: () => 'three' },
    ]);
    const { lines } = await exportedCsv();
    expect(lines[0]).toBe('Amount');
    expect(lines[1]).toBe('three');
  });

  it('neutralises formula text but leaves negative amounts alone', async () => {
    useTable([
      { note: '=HYPERLINK("http://x","y")' },
      { note: '-12.50' },
      { note: '($12.50)' },
      { note: '-cmd' },
    ], [{ field: 'note', header: 'Note' }]);
    const { lines } = await exportedCsv();
    expect(lines[1]).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(lines[2]).toBe('-12.50');
    expect(lines[3]).toBe('($12.50)');
    expect(lines[4]).toBe('"\'-cmd"');
  });

  it('leaves negative currency text alone and prefixes =cmd', async () => {
    useTable([{ note: '-$1,234.56' }, { note: '=cmd' }], [{ field: 'note', header: 'Note' }]);
    const { lines } = await exportedCsv();
    expect(lines[1]).toBe('"-$1,234.56"');
    expect(lines[2]).toBe('"\'=cmd"');
  });

  it('exports a 1,000-row table with a templated column', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ name: `R${i}`, amount: i }));
    useTable(rows, [{ field: 'name', header: 'Name' }, { field: 'amount', header: 'Amount', type: 'number' }]);
    const { lines } = await exportedCsv();
    expect(lines.filter(l => l !== '')).toHaveLength(1001);
    expect(lines[1000]).toBe('R999,$999.00');
  });

  it('keeps a templated number column numeric in the Excel export', () => {
    useTable([], [{ field: 'amount', header: 'Amount', type: 'number' }]);
    const cell = (table as unknown as { toExcelCell(row: unknown, col: ColumnDef): unknown })
      .toExcelCell({ amount: 12.5 }, { field: 'amount', header: 'Amount', type: 'number' });
    expect(cell).toEqual({ type: Number, value: 12.5 });
  });

  it('names the file from exportFileName when one is given', () => {
    Object.defineProperty(table, 'exportFileName', { value: () => 'ar-aging-2026-10-19' });
    useTable([{ name: 'A' }], [{ field: 'name', header: 'Name' }]);
    let downloaded = '';
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) { downloaded = this.download; });
    table.exportCsv();
    expect(downloaded).toBe('ar-aging-2026-10-19.csv');
  });
});

describe('DataTableComponent · phone column priority', () => {
  const columns: ColumnDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email', phoneHidden: true },
    { field: 'notes', header: 'Notes', visible: false },
  ];
  let phone: BehaviorSubject<BreakpointState>;
  let saved: Record<string, unknown> | null;

  function create(): string[] {
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('tableId', 'phone-test');
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', []);
    fixture.componentInstance.ngOnInit();
    const table = fixture.componentInstance as unknown as { visibleColumns: () => ColumnDef[] };
    return table.visibleColumns().map(c => c.field);
  }

  beforeEach(() => {
    phone = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    saved = null;
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: ComponentFixtureAutoDetect, useValue: false },
        { provide: UserPreferencesService, useValue: { get: () => saved, set: () => undefined } },
        { provide: BreakpointObserver, useValue: { observe: () => phone.asObservable() } },
      ],
    });
  });

  it('shows phone-hidden columns at desktop width', () => {
    expect(create()).toEqual(['name', 'email']);
  });

  it('hides phone-hidden columns at phone width', () => {
    phone.next({ matches: true, breakpoints: {} });
    expect(create()).toEqual(['name']);
  });

  it('lets a visibility the user saved override the phone default', () => {
    phone.next({ matches: true, breakpoints: {} });
    saved = { columnVisibility: { email: true } };
    expect(create()).toEqual(['name', 'email']);
  });
});

describe('DataTableComponent · selection checkboxes', () => {
  it('gives the select-all and row checkboxes an accessible name', () => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogLoader } }),
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    TestBed.inject(TranslateService).use('en');
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('tableId', 'spec-table');
    fixture.componentRef.setInput('columns', [{ field: 'name', header: 'Name' }]);
    fixture.componentRef.setInput('data', [{ id: 1, name: 'A' }]);
    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();

    const inputs = Array.from(fixture.nativeElement.querySelectorAll('mat-checkbox input')) as HTMLInputElement[];
    expect(inputs.map(i => i.getAttribute('aria-label'))).toEqual(['Select all rows', 'Select row']);
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
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: EmptyLoader } }),
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

describe('DataTableComponent · column headers', () => {
  const columns: ColumnDef[] = [
    { field: 'name', header: 'common.name' },
    { field: 'code', header: 'Code' },
  ];
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { common: { name: 'Name' } });
    translate.setTranslation('es', { common: { name: 'Nombre' } });
    translate.use('en');
  });

  function headerTexts(fixture: ComponentFixture<DataTableComponent>): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.data-table__th-content'),
      el => el.textContent?.trim() ?? '',
    );
  }

  it('shows a header key in the current language and follows a live language switch', () => {
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('tableId', 'header-spec');
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', [{ id: 1, name: 'Bracket', code: 'BR-1' }]);
    fixture.detectChanges();
    expect(headerTexts(fixture)).toEqual(['Name', 'Code']);

    translate.use('es');
    fixture.detectChanges();

    expect(headerTexts(fixture)).toEqual(['Nombre', 'Code']);
  });
});
