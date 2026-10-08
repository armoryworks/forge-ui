import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { JobStatus } from '../models/mobile-api.model';
import { MobileMoveConfirmService } from './mobile-move-confirm.service';

const base: JobStatus = {
  id: 42, jobNumber: 'JOB-42', title: 'Bracket', customerName: null, stageId: 5, stageName: 'Shipped',
  stageColor: '#000', dueDate: null, isOverdue: false, nextStageId: 6, nextStageName: 'Invoiced',
  previousStageId: 4, previousStageName: 'QC', rowVersion: 1, recentActivity: [],
};

describe('MobileMoveConfirmService', () => {
  let service: MobileMoveConfirmService;
  const open = vi.fn();
  const instant = vi.fn((key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key));

  beforeEach(() => {
    open.mockReset().mockReturnValue({ afterClosed: () => of(true) });
    instant.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open } },
        { provide: TranslateService, useValue: { instant } },
      ],
    });
    service = TestBed.inject(MobileMoveConfirmService);
  });

  it('asks only for a next column that can\'t be undone or that creates an accounting document', () => {
    expect(service.needed(base)).toBe(false);
    expect(service.needed({ ...base, nextStageIsIrreversible: true })).toBe(true);
    expect(service.needed({ ...base, nextStageAccountingDocument: 'Invoice' })).toBe(true);
    expect(service.needed({ ...base, nextStageId: null, nextStageIsIrreversible: true })).toBe(false);
  });

  it('names the column and the document it creates', async () => {
    const confirmed = await service.ask({ ...base, nextStageIsIrreversible: true, nextStageAccountingDocument: 'Invoice' });

    expect(confirmed).toBe(true);
    const data = open.mock.calls[0][1].data;
    expect(data.title).toBe('mobileAppWork.confirmMove.title {"job":"JOB-42","status":"Invoiced"}');
    expect(data.message).toBe('mobileAppWork.confirmMove.createsIrreversible {"document":"mobileAppWork.confirmMove.document.Invoice"}');
    expect(data.confirmLabel).toBe('mobileAppWork.confirmMove.confirm {"status":"Invoiced"}');
  });

  it('says a column with no document can\'t be undone, and reports a decline', async () => {
    open.mockReturnValue({ afterClosed: () => of(undefined) });

    expect(await service.ask({ ...base, nextStageIsIrreversible: true })).toBe(false);
    expect(open.mock.calls[0][1].data.message).toBe('mobileAppWork.confirmMove.irreversible {"document":null}');
  });

  it('recognises the server asking for a confirmation', () => {
    expect(service.isConfirmRequired(new HttpErrorResponse({ status: 400, error: { code: 'confirm-required' } }))).toBe(true);
    expect(service.isConfirmRequired(new HttpErrorResponse({ status: 400, error: { title: 'Bad' } }))).toBe(false);
    expect(service.isConfirmRequired(new Error('x'))).toBe(false);
  });
});
