import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

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
