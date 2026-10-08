import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { ScannerService } from '../../../../shared/services/scanner.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WebHidRfidService } from '../../../../shared/services/web-hid-rfid.service';
import { NonConformance } from '../../../quality/models/non-conformance.model';
import { QcInspection } from '../../../quality/models/qc-inspection.model';
import { QcTemplate } from '../../../quality/models/qc-template.model';
import { KioskInspectionLookup } from '../../models/kiosk-inspection-lookup.model';
import { KioskInspectionTarget } from '../../models/kiosk-inspection-target.model';
import { KioskInspectionService } from '../../services/kiosk-inspection.service';
import { ScanActionOverlayComponent } from '../scan-action-overlay/scan-action-overlay.component';
import { ScanInspectFlowComponent } from './scan-inspect-flow.component';

const TARGET: KioskInspectionTarget = { jobId: 31, jobNumber: 'J-1031', lotNumber: 'LOT-7', lotQuantity: 40 };

const INSPECTION: QcInspection = {
  id: 11,
  jobId: 31,
  jobNumber: 'J-1031',
  partId: 5,
  partNumber: 'P-5',
  productionRunId: null,
  templateId: 4,
  templateName: 'Final',
  inspectorId: 7,
  inspectorName: 'Pat Inspector',
  lotNumber: 'LOT-7',
  status: 'InProgress',
  notes: null,
  completedAt: null,
  results: [
    { id: 101, checklistItemId: 1, description: 'Visual', specification: null, isRequired: true, passed: null, measuredValue: null, notes: null },
    { id: 102, checklistItemId: 2, description: 'Fit', specification: '2.5 mm', isRequired: false, passed: null, measuredValue: '2.5', notes: null },
  ],
  createdAt: new Date('2026-09-01'),
};

interface FlowInternals {
  ngOnInit: () => void;
  onReferenceScanned: (value: string) => void;
  skipReference: () => void;
  chooseTemplate: (templateId: number) => void;
  cancel: () => void;
  templates: () => QcTemplate[];
  setResult: (value: 'Pass' | 'Fail') => void;
  submitInspection: () => void;
  openNcr: () => void;
  raiseNcr: () => void;
  finish: () => void;
  step: () => string;
  target: () => KioskInspectionTarget | null;
  error: () => string | null;
  referenceError: () => string | null;
  ncrError: () => string | null;
  ncrNumber: () => string | null;
  checklist: () => { id: number; specification?: string | null; isRequired?: boolean }[];
  checklistForm: { get: (key: string) => { setValue: (value: boolean) => void; value: boolean } | null };
  ncrForm: {
    getRawValue: () => { description: string; affectedQuantity: number | null };
    controls: { affectedQuantity: { setValue: (value: number | null) => void } };
  };
  notesControl: { setValue: (value: string) => void };
  canPass: () => boolean;
  canSubmit: () => boolean;
  canRaiseNcr: () => boolean;
  completed: { emit: () => void };
  cancelled: { emit: () => void };
}

interface SetupOptions {
  lookup?: Observable<KioskInspectionLookup>;
  open?: Observable<QcInspection>;
  completeResponses?: Observable<QcInspection>[];
  ncr?: Observable<NonConformance>;
  templateId?: number | null;
  templates?: QcTemplate[];
}

function template(id: number, name: string): QcTemplate {
  return { id, name, description: null, partId: 5, partNumber: 'P-5', isActive: true, items: [] };
}

function wedgeScan(value: string): void {
  for (const key of [...value, 'Enter'])
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function setup(options: SetupOptions = {}) {
  const findTarget = vi.fn(() => options.lookup ?? of<KioskInspectionLookup>({ status: 'found', target: TARGET }));
  const openInspection = vi.fn(() => options.open ?? of(INSPECTION));
  const responses = options.completeResponses ?? [of(INSPECTION)];
  const completeInspection = vi.fn(() => responses.shift()!);
  const raiseNcr = vi.fn(() => options.ncr ?? of({ id: 9, ncrNumber: 'NCR-0009' } as NonConformance));
  const findTemplates = vi.fn(() => of(options.templates ?? []));
  const getContext = vi.fn(() => NEVER);
  TestBed.configureTestingModule({
    providers: [
      { provide: KioskInspectionService, useValue: { findTarget, findTemplates, openInspection, completeInspection, raiseNcr } },
      { provide: TranslateService, useValue: { instant: (k: string, p?: Record<string, unknown>) => p ? `${k}:${JSON.stringify(p)}` : k } },
      { provide: WebHidRfidService, useValue: { lastScan: signal(null), clearLastScan: vi.fn(), reconnect: () => Promise.resolve(false) } },
      { provide: ScanActionService, useValue: { getContext } },
      { provide: SnackbarService, useValue: { info: vi.fn(), success: vi.fn(), warn: vi.fn() } },
    ],
  });
  const scanner = TestBed.inject(ScannerService);
  scanner.setContext('shop-floor');
  const component = TestBed.runInInjectionContext(() => new ScanInspectFlowComponent());
  mockSignalInputs(component, {
    partId: 5,
    partNumber: 'P-5',
    qcTemplateId: options.templateId === undefined ? 4 : options.templateId,
  });
  const flow = component as unknown as FlowInternals;
  flow.ngOnInit();
  const emitted = vi.spyOn(flow.completed, 'emit');
  const cancelled = vi.spyOn(flow.cancelled, 'emit');
  const check = (resultId: number) => flow.checklistForm.get(String(resultId))!.setValue(true);
  return {
    flow, check, emitted, cancelled, scanner, getContext,
    findTarget, findTemplates, openInspection, completeInspection, raiseNcr,
  };
}

describe('ScanInspectFlowComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => {
    TestBed.inject(ScannerService).stop();
    vi.useRealTimers();
  });

  describe('work order or lot', () => {
    it('asks for the work order or lot before anything is created', () => {
      const { flow, openInspection } = setup();

      expect(flow.step()).toBe('reference');
      expect(openInspection).not.toHaveBeenCalled();
    });

    it('starts the inspection linked to the scanned work order, part and lot', () => {
      const { flow, findTarget, openInspection } = setup();

      flow.onReferenceScanned('  J-1031 ');

      expect(findTarget).toHaveBeenCalledWith(5, 'J-1031');
      expect(openInspection).toHaveBeenCalledWith(5, 4, TARGET);
      expect(flow.target()).toEqual(TARGET);
      expect(flow.step()).toBe('inspect');
    });

    it('stays on the scan step when nothing matches', () => {
      const { flow, openInspection } = setup({ lookup: of<KioskInspectionLookup>({ status: 'notFound' }) });

      flow.onReferenceScanned('NOPE-1');

      expect(openInspection).not.toHaveBeenCalled();
      expect(flow.step()).toBe('reference');
      expect(flow.referenceError()).toBe('kioskInspect.referenceNotFound:{"value":"NOPE-1"}');
    });

    it('refuses a work order or lot for another part', () => {
      const { flow, openInspection } = setup({
        lookup: of<KioskInspectionLookup>({ status: 'otherPart', partNumber: 'P-9' }),
      });

      flow.onReferenceScanned('LOT-9');

      expect(openInspection).not.toHaveBeenCalled();
      expect(flow.referenceError()).toBe('kioskInspect.referenceOtherPart:{"value":"LOT-9","partNumber":"P-9"}');
    });

    it('shows the server reason and returns to the scan step when the start is refused', () => {
      const { flow } = setup({
        open: throwError(() => ({ status: 400, error: { detail: 'Pick a work order that exists.' } })),
      });

      flow.onReferenceScanned('J-1031');

      expect(flow.step()).toBe('reference');
      expect(flow.target()).toBeNull();
      expect(flow.referenceError()).toBe('Pick a work order that exists.');
    });

    it('takes a hardware scan of the work order away from the kiosk and overlay', () => {
      const { flow, scanner, findTarget, openInspection, getContext } = setup();
      TestBed.runInInjectionContext(() => new ScanActionOverlayComponent());
      scanner.start();
      TestBed.tick();
      expect(scanner.context()).toBe('kiosk-inspect');

      wedgeScan('J-1031');
      TestBed.tick();

      expect(findTarget).toHaveBeenCalledWith(5, 'J-1031');
      expect(openInspection).toHaveBeenCalledWith(5, 4, TARGET);
      expect(getContext).not.toHaveBeenCalled();
      expect(scanner.lastScan()).toBeNull();
      expect(flow.step()).toBe('inspect');
      expect(scanner.context()).toBe('shop-floor');
    });

    it('leaves scans to the host once the inspection has started', () => {
      const { flow, scanner, findTarget, getContext } = setup();
      TestBed.runInInjectionContext(() => new ScanActionOverlayComponent());
      scanner.start();
      flow.onReferenceScanned('J-1031');
      TestBed.tick();

      wedgeScan('P-5-BARCODE');
      TestBed.tick();

      expect(findTarget).toHaveBeenCalledTimes(1);
      expect(getContext).toHaveBeenCalledWith('P-5-BARCODE');
    });

    it('can still inspect without a work order', () => {
      const { flow, openInspection } = setup();

      flow.skipReference();

      expect(openInspection).toHaveBeenCalledWith(5, 4, { jobId: null, jobNumber: null, lotNumber: null, lotQuantity: null });
      expect(flow.step()).toBe('inspect');
    });
  });

  describe('starting', () => {
    it('asks which checklist to use when the part has several', () => {
      const { flow, openInspection } = setup({ templateId: null, templates: [template(4, 'Final'), template(3, 'First article')] });

      flow.onReferenceScanned('J-1031');

      expect(flow.step()).toBe('template');
      expect(flow.templates().map(t => t.id)).toEqual([4, 3]);
      expect(openInspection).not.toHaveBeenCalled();

      flow.chooseTemplate(3);

      expect(openInspection).toHaveBeenCalledWith(5, 3, TARGET);
      expect(flow.step()).toBe('inspect');
    });

    it('uses the only checklist of the part without asking', () => {
      const { flow, openInspection } = setup({ templateId: null, templates: [template(4, 'Final')] });

      flow.onReferenceScanned('J-1031');

      expect(openInspection).toHaveBeenCalledWith(5, 4, TARGET);
    });

    it('starts without a checklist when the part has none', () => {
      const { flow, openInspection, findTemplates } = setup({ templateId: null });

      flow.skipReference();

      expect(findTemplates).toHaveBeenCalledWith(5);
      expect(openInspection).toHaveBeenCalledWith(5, null, { jobId: null, jobNumber: null, lotNumber: null, lotQuantity: null });
    });

    it('can be cancelled while the inspection is being opened', () => {
      const pending = new Subject<QcInspection>();
      const { flow, cancelled } = setup({ open: pending });

      flow.onReferenceScanned('J-1031');
      expect(flow.step()).toBe('starting');

      flow.cancel();

      expect(pending.observed).toBe(false);
      expect(cancelled).toHaveBeenCalledTimes(1);
    });
  });

  describe('checklist', () => {
    it('shows the rows snapshotted on the inspection', () => {
      const { flow } = setup();
      flow.onReferenceScanned('J-1031');

      expect(flow.checklist().map(i => [i.id, i.specification, i.isRequired])).toEqual([
        [101, null, true],
        [102, '2.5 mm', false],
      ]);
    });

    it('pre-checks rows that already passed on a resumed inspection', () => {
      const resumed = { ...INSPECTION, results: [{ ...INSPECTION.results[0], passed: true }, INSPECTION.results[1]] };
      const { flow } = setup({ open: of(resumed) });
      flow.onReferenceScanned('J-1031');

      expect(flow.checklistForm.get('101')!.value).toBe(true);
      expect(flow.checklistForm.get('102')!.value).toBe(false);
      expect(flow.canPass()).toBe(true);
    });

    it('keeps Pass unavailable until every required row is checked', () => {
      const { flow, check, completeInspection } = setup();
      flow.onReferenceScanned('J-1031');

      flow.setResult('Pass');
      expect(flow.canPass()).toBe(false);
      expect(flow.canSubmit()).toBe(false);

      flow.submitInspection();
      expect(completeInspection).not.toHaveBeenCalled();

      check(101);
      expect(flow.canPass()).toBe(true);
      expect(flow.canSubmit()).toBe(true);
    });
  });

  describe('completion', () => {
    it('passes with only the rows the operator checked marked passed', () => {
      const { flow, check, completeInspection, emitted } = setup();
      flow.onReferenceScanned('J-1031');

      check(101);
      flow.setResult('Pass');
      flow.submitInspection();

      expect(completeInspection).toHaveBeenCalledWith(11, {
        status: 'Passed',
        notes: undefined,
        results: [
          { id: 101, checklistItemId: 1, description: 'Visual', passed: true, measuredValue: undefined, notes: undefined },
          { id: 102, checklistItemId: 2, description: 'Fit', passed: false, measuredValue: '2.5', notes: undefined },
        ],
      });
      expect(flow.step()).toBe('done');
      vi.advanceTimersByTime(1500);
      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('fails without checking any row and records which rows did not pass', () => {
      const { flow, completeInspection, emitted } = setup();
      flow.onReferenceScanned('J-1031');

      flow.setResult('Fail');
      expect(flow.canSubmit()).toBe(true);
      flow.submitInspection();

      expect(completeInspection).toHaveBeenCalledWith(11, expect.objectContaining({
        status: 'Failed',
        results: [
          expect.objectContaining({ id: 101, passed: false }),
          expect.objectContaining({ id: 102, passed: false }),
        ],
      }));
      expect(flow.step()).toBe('done');
      vi.advanceTimersByTime(5000);
      expect(emitted).not.toHaveBeenCalled();
    });

    it('shows the server reason and retries on the same inspection', () => {
      const reason = 'Inspection 11 cannot pass: required checklist items did not pass (Visual).';
      const { flow, check, openInspection, completeInspection } = setup({
        completeResponses: [throwError(() => ({ status: 409, error: { detail: reason } })), of(INSPECTION)],
      });
      flow.onReferenceScanned('J-1031');

      check(101);
      flow.setResult('Pass');
      flow.submitInspection();
      expect(flow.step()).toBe('inspect');
      expect(flow.error()).toBe(reason);

      flow.submitInspection();

      expect(openInspection).toHaveBeenCalledTimes(1);
      expect(completeInspection).toHaveBeenCalledTimes(2);
      expect(completeInspection).toHaveBeenNthCalledWith(2, 11, expect.objectContaining({ status: 'Passed' }));
      expect(flow.step()).toBe('done');
    });
  });

  describe('raise NCR', () => {
    function failInspection(options: SetupOptions = {}) {
      const ctx = setup(options);
      ctx.flow.onReferenceScanned('J-1031');
      ctx.check(102);
      ctx.flow.notesControl.setValue('Burr on edge');
      ctx.flow.setResult('Fail');
      ctx.flow.submitInspection();
      return ctx;
    }

    it('prefills the work order, lot, failed rows and notes', () => {
      const { flow } = failInspection();

      flow.openNcr();

      expect(flow.step()).toBe('ncr');
      expect(flow.ncrForm.getRawValue()).toEqual({
        description: [
          'kioskInspect.ncrSummary:{"id":11,"partNumber":"P-5"}',
          'kioskInspect.ncrWorkOrderLine:{"number":"J-1031"}',
          'kioskInspect.ncrLotLine:{"number":"LOT-7"}',
          'kioskInspect.ncrFailedItemsLine',
          '- Visual',
          'kioskInspect.ncrNotesLine:{"notes":"Burr on edge"}',
        ].join('\n'),
        affectedQuantity: 40,
      });
      expect(flow.canRaiseNcr()).toBe(true);
    });

    it('keeps a long prefilled description within the NCR limit', () => {
      const { flow } = failInspection();
      flow.notesControl.setValue('x'.repeat(5000));

      flow.openNcr();

      expect(flow.ncrForm.getRawValue().description.length).toBe(4000);
      expect(flow.canRaiseNcr()).toBe(true);
    });

    it('raises the NCR against the inspection and finishes', () => {
      const { flow, raiseNcr, emitted } = failInspection();
      flow.openNcr();

      flow.raiseNcr();

      expect(raiseNcr).toHaveBeenCalledWith(
        expect.objectContaining({ id: 11, jobId: 31, lotNumber: 'LOT-7' }),
        5,
        expect.stringContaining('- Visual'),
        40,
      );
      expect(flow.step()).toBe('ncrRaised');
      expect(flow.ncrNumber()).toBe('NCR-0009');
      vi.advanceTimersByTime(2000);
      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('needs a positive affected quantity', () => {
      const { flow, raiseNcr } = failInspection();
      flow.openNcr();

      flow.ncrForm.controls.affectedQuantity.setValue(0);
      expect(flow.canRaiseNcr()).toBe(false);
      flow.raiseNcr();

      expect(raiseNcr).not.toHaveBeenCalled();
    });

    it('keeps the form open with the reason when the NCR is refused', () => {
      const { flow } = failInspection({
        ncr: throwError(() => ({ status: 400, error: { detail: 'Part 5 not found' } })),
      });
      flow.openNcr();

      flow.raiseNcr();

      expect(flow.step()).toBe('ncr');
      expect(flow.ncrError()).toBe('Part 5 not found');
    });

    it('finishes without an NCR when the operator is done', () => {
      const { flow, raiseNcr, emitted } = failInspection();

      flow.finish();

      expect(raiseNcr).not.toHaveBeenCalled();
      expect(emitted).toHaveBeenCalledTimes(1);
    });
  });
});
