import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { RecurringOrdersService } from '../../services/recurring-orders.service';
import { RecurringOrderListItem } from '../../models/recurring-order.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { RecurringOrdersComponent } from './recurring-orders.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface Internals {
  rows(): RecurringOrderListItem[];
  togglingId(): number | null;
  toggleActive(row: RecurringOrderListItem): void;
}

function row(overrides: Partial<RecurringOrderListItem> = {}): RecurringOrderListItem {
  return {
    id: 4, name: 'Weekly widgets', customerId: 1, customerName: 'Acme', intervalDays: 7,
    nextGenerationDate: '2026-11-01T00:00:00Z', lastGeneratedDate: null, isActive: true, lineCount: 1,
    createdAt: '2026-10-01T00:00:00Z', ...overrides,
  };
}

describe('RecurringOrdersComponent', () => {
  let service: { list: ReturnType<typeof vi.fn>; activate: ReturnType<typeof vi.fn>; deactivate: ReturnType<typeof vi.fn> };
  let snackbar: { success: ReturnType<typeof vi.fn> };

  function build(rows: RecurringOrderListItem[]): Internals {
    service.list.mockReturnValue(of(rows));
    const component = TestBed.runInInjectionContext(() => new RecurringOrdersComponent());
    return component as unknown as Internals;
  }

  beforeEach(() => {
    service = { list: vi.fn(), activate: vi.fn(), deactivate: vi.fn() };
    snackbar = { success: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: RecurringOrdersService, useValue: service },
        { provide: SnackbarService, useValue: snackbar },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });
  });

  it('pauses an active template and shows it inactive', () => {
    const page = build([row()]);
    service.deactivate.mockReturnValue(of({ ...row(), isActive: false }));

    page.toggleActive(page.rows()[0]);

    expect(service.deactivate).toHaveBeenCalledWith(4);
    expect(page.rows()[0].isActive).toBe(false);
    expect(snackbar.success).toHaveBeenCalledWith('salesOrders.recurring.paused');
  });

  it('resumes a paused template and takes the moved-forward next run', () => {
    const page = build([row({ isActive: false, nextGenerationDate: '2026-09-01T00:00:00Z' })]);
    service.activate.mockReturnValue(of({ ...row(), isActive: true, nextGenerationDate: '2026-10-29T00:00:00Z' }));

    page.toggleActive(page.rows()[0]);

    expect(service.activate).toHaveBeenCalledWith(4);
    expect(page.rows()[0].isActive).toBe(true);
    expect(page.rows()[0].nextGenerationDate).toBe('2026-10-29T00:00:00Z');
  });

  it('leaves the row alone and re-enables the toggle when the call fails', () => {
    const page = build([row()]);
    service.deactivate.mockReturnValue(throwError(() => new Error('boom')));

    page.toggleActive(page.rows()[0]);

    expect(page.rows()[0].isActive).toBe(true);
    expect(page.togglingId()).toBeNull();
  });
});
