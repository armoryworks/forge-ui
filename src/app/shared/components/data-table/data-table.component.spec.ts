import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';

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
