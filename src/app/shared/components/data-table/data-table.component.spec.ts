import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

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
        provideTranslateService(),
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
