import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, TemplateRef, viewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TestBed, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DataTableComponent } from './data-table.component';
import { ColumnDef } from '../../models/column-def.model';
import { UserPreferencesService } from '../../services/user-preferences.service';

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
