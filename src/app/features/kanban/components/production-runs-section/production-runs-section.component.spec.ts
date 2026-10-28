import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ProductionRun } from '../../models/production-run.model';
import { KanbanService } from '../../services/kanban.service';
import { JobSurplusSplit } from '../../models/job-surplus-split.model';
import { ProductionRunsService } from '../../services/production-runs.service';
import { ProductionRunsSectionComponent } from './production-runs-section.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function run(overrides: Partial<ProductionRun> = {}): ProductionRun {
  return {
    id: 11, jobId: 7, jobNumber: 'J-7', partId: 3, partNumber: 'CAP-1', partDescription: 'Cap', operatorId: null, operatorName: null,
    runNumber: 'RUN-20261026-001', targetQuantity: 2000, completedQuantity: 0, scrapQuantity: 0, status: 'Planned',
    startedAt: null, completedAt: null, notes: null, setupTimeMinutes: null, runTimeMinutes: null, yieldPercentage: 0,
    receivedQuantity: 0, receivedToStockAt: null, workCenterId: 4, workCenterName: 'Press 1', toolingAssetId: 9,
    toolingAssetName: 'Mold A', toolingCavityCount: 4, shotsApplied: 0, runTimeManual: false, receiptJournalEntryNumber: null,
    ...overrides,
  };
}

function setup(opts: { runs?: ProductionRun[]; capability?: boolean; roles?: boolean; partId?: number | null; split?: JobSurplusSplit } = {}) {
  const runs = opts.runs ?? [run()];
  const service = {
    getRuns: vi.fn(() => of(runs)),
    updateRun: vi.fn(() => of(run({ status: 'InProgress' }))),
    receiveToStock: vi.fn(() => of(run({ status: 'Completed', receivedQuantity: 1940, receiptJournalEntryNumber: 812 }))),
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
  const kanban = {
    getSurplusSplit: vi.fn((_jobId: number, quantity: number) => of(opts.split
      ?? { demandQuantity: quantity, surplusQuantity: 0, surplusLocationId: null, surplusLocationName: null })),
  };
  const snackbar = { success: vi.fn(), errorFrom: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ProductionRunsSectionComponent],
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: ProductionRunsService, useValue: service },
      { provide: KanbanService, useValue: kanban },
      { provide: AuthService, useValue: { hasAnyRole: vi.fn(() => opts.roles ?? true) } },
      { provide: CapabilityService, useValue: { isEnabled: vi.fn((code: string) => (opts.capability ?? true) && code === 'CAP-MFG-COMPLETE') } },
      { provide: MatDialog, useValue: dialog },
      { provide: SnackbarService, useValue: snackbar },
    ],
  });
  const fixture = TestBed.createComponent(ProductionRunsSectionComponent);
  fixture.componentRef.setInput('jobId', 7);
  fixture.componentRef.setInput('partId', opts.partId === undefined ? 3 : opts.partId);
  fixture.componentRef.setInput('jobQuantity', 2000);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, service, dialog, snackbar, kanban, component: fixture.componentInstance };
}

describe('ProductionRunsSectionComponent', () => {
  it('lists the job\'s runs with their tooling and a Start action', () => {
    const { el, service } = setup();

    expect(service.getRuns).toHaveBeenCalledWith(7);
    expect(el.querySelector('[data-testid="production-run-11"]')?.textContent).toContain('RUN-20261026-001');
    expect(el.querySelector('[data-testid="production-run-start-11"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="production-run-receive-11"]')).toBeNull();
  });

  it('starts a run by moving it to in progress', () => {
    const { el, service } = setup();

    (el.querySelector('[data-testid="production-run-start-11"]') as HTMLButtonElement).click();

    expect(service.updateRun).toHaveBeenCalledWith(7, 11, expect.objectContaining({ status: 'InProgress', runTimeMinutes: null }));
  });

  it('stops an in-progress run by completing it', () => {
    const { component, service } = setup({ runs: [run({ status: 'InProgress', completedQuantity: 100 })] });

    component.stop(run({ status: 'InProgress', completedQuantity: 100 }));

    expect(service.updateRun).toHaveBeenCalledWith(7, 11, expect.objectContaining({ status: 'Completed', completedQuantity: 100 }));
  });

  it('offers receive to stock on a completed run and reports the posted journal', () => {
    const completed = run({ status: 'Completed', completedQuantity: 1940, scrapQuantity: 60 });
    const { el, service, snackbar } = setup({ runs: [completed] });

    (el.querySelector('[data-testid="production-run-receive-11"]') as HTMLButtonElement).click();

    expect(service.receiveToStock).toHaveBeenCalledWith(7, 11);
    expect(snackbar.success).toHaveBeenCalledWith('productionRuns.receivedWithJournal');
  });

  it('shows a received run without receive or edit actions', () => {
    const received = run({ status: 'Completed', completedQuantity: 1940, receivedQuantity: 1940, receivedToStockAt: '2026-10-26T12:00:00Z', receiptJournalEntryNumber: 812 });
    const { el } = setup({ runs: [received] });

    expect(el.querySelector('[data-testid="production-run-received-11"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="production-run-receive-11"]')).toBeNull();
    expect(el.querySelector('[data-testid="production-run-edit-11"]')).toBeNull();
  });

  it('opens the run dialog for a new run with the job quantity as the target', () => {
    const { el, dialog } = setup({ runs: [] });

    expect(el.querySelector('[data-testid="production-runs-empty"]')).not.toBeNull();
    (el.querySelector('[data-testid="production-run-new"]') as HTMLButtonElement).click();

    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: { jobId: 7, partId: 3, defaultTargetQuantity: 2000, run: null },
    }));
  });

  it('hides itself and loads nothing when completion is turned off', () => {
    const { el, service } = setup({ capability: false });

    expect(el.querySelector('[data-testid="production-runs-section"]')).toBeNull();
    expect(service.getRuns).not.toHaveBeenCalled();
  });

  it('hides itself for a role the run endpoints refuse', () => {
    const { el, service } = setup({ roles: false });

    expect(el.querySelector('[data-testid="production-runs-section"]')).toBeNull();
    expect(service.getRuns).not.toHaveBeenCalled();
  });

  it('hides itself on a job with no part', () => {
    const { el } = setup({ partId: null });

    expect(el.querySelector('[data-testid="production-runs-section"]')).toBeNull();
  });

  it('names the surplus split in the receive confirmation', () => {
    const completed = run({ status: 'Completed', completedQuantity: 114 });
    const { el, dialog, kanban } = setup({
      runs: [completed],
      split: { demandQuantity: 100, surplusQuantity: 14, surplusLocationId: 5, surplusLocationName: 'SURPLUS' },
    });

    (el.querySelector('[data-testid="production-run-receive-11"]') as HTMLButtonElement).click();

    expect(kanban.getSurplusSplit).toHaveBeenCalledWith(7, 114, 11);
    expect((dialog.open.mock.calls[0] as unknown[])[1]).toEqual(expect.objectContaining({
      data: expect.objectContaining({ message: 'productionRuns.receiveMessage productionRuns.receiveSurplus' }),
    }));
  });
});
