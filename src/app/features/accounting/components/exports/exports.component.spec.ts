import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ExportsComponent } from './exports.component';
import { AccountingExportService } from '../../services/accounting-export.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface ExportsApi {
  confirmPush(): void;
}

const OK = { qboDocId: 'QBO-2', fromDate: '2026-06-01', toDate: '2026-06-30', totalDebit: 100, lineCount: 2 };
const overlap = () => new HttpErrorResponse({ status: 409, error: { code: 'qbo-push-overlap', detail: 'A QuickBooks push already covers 2026-06-01..2026-06-15' } });

describe('ExportsComponent QuickBooks push', () => {
  const exportService = { pushToQbo: vi.fn(), getQboMappings: vi.fn() };
  const dialog = { open: vi.fn() };
  const snackbar = { success: vi.fn(), errorFrom: vi.fn() };
  let answers: boolean[];

  function create(): ExportsApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountingExportService, useValue: exportService },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: snackbar },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(ExportsComponent, { set: { template: '', imports: [], styles: [] } });
    return TestBed.createComponent(ExportsComponent).componentInstance as unknown as ExportsApi;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    answers = [];
    dialog.open.mockImplementation(() => ({ afterClosed: () => of(answers.shift() ?? false) }));
  });

  it('asks before re-pushing an overlapping range and resends with force', () => {
    answers = [true, true];
    exportService.pushToQbo.mockReturnValueOnce(throwError(overlap)).mockReturnValueOnce(of(OK));
    create().confirmPush();

    expect(exportService.pushToQbo).toHaveBeenNthCalledWith(1, 1, expect.any(String), expect.any(String), false);
    expect(dialog.open).toHaveBeenCalledTimes(2);
    expect(dialog.open.mock.calls[1][1].data).toEqual(expect.objectContaining({
      title: 'accounting.exports.overlapTitle',
      details: ['A QuickBooks push already covers 2026-06-01..2026-06-15'],
    }));
    expect(exportService.pushToQbo).toHaveBeenNthCalledWith(2, 1, expect.any(String), expect.any(String), true);
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('does not re-push when the overlap confirm is declined', () => {
    answers = [true, false];
    exportService.pushToQbo.mockReturnValueOnce(throwError(overlap));
    create().confirmPush();
    expect(exportService.pushToQbo).toHaveBeenCalledTimes(1);
  });

  it('reports any other refusal without offering a forced push', () => {
    answers = [true];
    exportService.pushToQbo.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'business-rule', detail: 'unmapped' } })));
    create().confirmPush();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(snackbar.errorFrom).toHaveBeenCalledWith(expect.any(HttpErrorResponse), 'accounting.exports.pushFailed');
  });
});
