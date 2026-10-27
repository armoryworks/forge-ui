import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { LotService } from '../../services/lot.service';
import { LotTrace, LotTraceEvent } from '../../models/lot-trace.model';
import { LotDetailPanelComponent } from './lot-detail-panel.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { RecallDetail } from '../../../quality/models/recall-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FileAttachment } from '../../../../shared/models/file.model';

function event(overrides: Partial<LotTraceEvent>): LotTraceEvent {
  return {
    type: 'QcInspection',
    referenceNumber: 'QC #1',
    description: 'InProgress',
    date: new Date('2026-09-01'),
    quantity: null,
    ...overrides,
  };
}

const TRACE: LotTrace = {
  lotNumber: 'LOT-1',
  partNumber: 'P-1',
  partDescription: 'Bracket',
  quantity: 10,
  expirationDate: null,
  supplierLotNumber: null,
  events: [],
  shippedTo: [
    { shipmentId: 3, shipmentNumber: 'SHP-3', customerId: 9, customerName: 'Downstream Buyer', shippedDate: new Date('2026-09-02'), quantity: 4 },
  ],
};

const FULL_TRACE: LotTrace = {
  ...TRACE,
  receivedFrom: [
    { receivingRecordId: 5, receiptNumber: 'RCV-5', purchaseOrderId: 2, poNumber: 'PO-2', vendorId: 6, vendorName: 'Resin Supplier', receivedAt: new Date('2026-08-30'), quantity: 10, inspectionStatus: 'PartialAccept' },
  ],
  inspections: [
    { id: 11, status: 'Passed', inspectorName: 'Pat Inspector', createdAt: new Date('2026-08-31'), templateName: 'Incoming', completedAt: null, passedCount: 3, failedCount: 0 },
  ],
  nonConformances: [
    { id: 21, ncrNumber: 'NCR-21', type: 'Supplier', status: 'UnderReview', detectedAt: new Date('2026-09-01'), description: 'Flash on edge', affectedQuantity: 2, dispositionCode: null },
  ],
  producingJob: { id: 8, jobNumber: 'J-8', title: 'Bracket run' },
};

const RECALL = { id: 4, affectedShipmentsCount: 2 } as RecallDetail;

interface PanelInternals {
  trace: () => LotTrace | null;
  statusKey: (e: LotTraceEvent) => string | null;
  receiptStatusKey: (status: string) => string;
  inspectionStatusKey: (status: string) => string;
  ncrStatusKey: (status: string) => string;
  canInitiateRecall: () => boolean;
  canEdit: boolean;
  editing: () => boolean;
  openEdit: () => void;
  onLotSaved: () => void;
  initiatedRecall: () => RecallDetail | null;
  openInitiateRecall: () => void;
  openRecall: (id: number) => void;
  closed: { emit: () => void };
  canAttachFiles: () => boolean;
  files: () => FileAttachment[];
  deleteFile: (doc: FileAttachment) => void;
  onFileUploaded: () => void;
}

const CERT = { id: 31, fileName: 'mill-cert.pdf', contentType: 'application/pdf', size: 2048 } as FileAttachment;

interface SetupOptions {
  roles?: string[];
  recallEnabled?: boolean;
  traceResult?: LotTrace;
  dialogResult?: RecallDetail | boolean;
  inDialog?: boolean;
  attachmentsEnabled?: boolean;
}

function setup(options: SetupOptions = {}) {
  const trace = vi.fn(() => of(options.traceResult ?? TRACE));
  const getFiles = vi.fn(() => of([CERT]));
  const deleteFile = vi.fn(() => of(undefined));
  const success = vi.fn();
  const roles = options.roles ?? ['Manager'];
  const dialogOpen = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
  const navigate = vi.fn(() => Promise.resolve(true));
  const hostClosed = new Subject<void>();
  const hostDialogRef = { afterClosed: () => hostClosed.asObservable() };
  TestBed.configureTestingModule({
    providers: [
      { provide: LotService, useValue: { trace, getFiles, deleteFile, downloadFileUrl: (id: number) => `/files/${id}/download` } },
      { provide: SnackbarService, useValue: { success } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: CapabilityService, useValue: { isEnabled: (code: string) =>
        (code === 'CAP-QC-RECALL' && (options.recallEnabled ?? true))
        || (code === 'CAP-CROSS-ATTACHMENTS' && (options.attachmentsEnabled ?? false)) } },
      { provide: MatDialog, useValue: { open: dialogOpen } },
      { provide: Router, useValue: { navigate } },
      ...(options.inDialog ? [{ provide: MatDialogRef, useValue: hostDialogRef }] : []),
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LotDetailPanelComponent());
  mockSignalInputs(component, { lotId: 1, lotNumber: 'LOT-1' });
  TestBed.tick();
  return { panel: component as unknown as PanelInternals, trace, dialogOpen, navigate, hostClosed, getFiles, deleteFile, success };
}

describe('LotDetailPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the trace including the customers the lot shipped to', () => {
    const { panel, trace } = setup();

    expect(trace).toHaveBeenCalledWith('LOT-1');
    expect(panel.trace()?.shippedTo?.[0].customerName).toBe('Downstream Buyer');
  });

  it('translates inspection status codes with the quality status keys', () => {
    const { panel } = setup();

    expect(panel.statusKey(event({ statusCode: 'InProgress' }))).toBe('quality.statusInProgress');
    expect(panel.statusKey(event({ statusCode: 'Failed', actor: 'Pat Inspector' }))).toBe('quality.statusFailed');
  });

  it('translates production-run status codes with the status keys', () => {
    const { panel } = setup();

    expect(panel.statusKey(event({ type: 'ProductionRun', statusCode: 'Planned' }))).toBe('status.planned');
    expect(panel.statusKey(event({ type: 'ProductionRun', statusCode: 'Completed' }))).toBe('status.completed');
  });

  it('falls back to the description when there is no known status code', () => {
    const { panel } = setup();

    expect(panel.statusKey(event({ type: 'Job', statusCode: null }))).toBeNull();
    expect(panel.statusKey(event({ statusCode: 'Unknown' }))).toBeNull();
  });

  it('loads the received-from, inspection, NCR and producing-job sections when the trace has them', () => {
    const { panel } = setup({ traceResult: FULL_TRACE });

    expect(panel.trace()?.receivedFrom?.[0].vendorName).toBe('Resin Supplier');
    expect(panel.trace()?.producingJob?.jobNumber).toBe('J-8');
    expect(panel.receiptStatusKey('PartialAccept')).toBe('inventory.receivingInspection.results.partialAccept');
    expect(panel.inspectionStatusKey('Passed')).toBe('quality.statusPassed');
    expect(panel.ncrStatusKey('UnderReview')).toBe('recalls.trace.ncrStatusUnderReview');
    expect(panel.ncrStatusKey('Mystery')).toBe('Mystery');
  });

  it('offers Initiate recall to a Manager when CAP-QC-RECALL is on', () => {
    expect(setup().panel.canInitiateRecall()).toBe(true);
  });

  it('hides Initiate recall from an Engineer', () => {
    expect(setup({ roles: ['Engineer'] }).panel.canInitiateRecall()).toBe(false);
  });

  it('hides Initiate recall when CAP-QC-RECALL is off', () => {
    expect(setup({ recallEnabled: false }).panel.canInitiateRecall()).toBe(false);
  });

  it('opens the initiate dialog for this lot and keeps the started recall', () => {
    const { panel, dialogOpen } = setup({ dialogResult: RECALL });

    panel.openInitiateRecall();

    expect(dialogOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { lotId: 1, lotNumber: 'LOT-1' } }));
    expect(panel.initiatedRecall()?.id).toBe(4);
  });

  it('closes the lot dialog before navigating to the recall', () => {
    const { panel, navigate, hostClosed } = setup({ inDialog: true });
    const emit = vi.spyOn(panel.closed, 'emit');

    panel.openRecall(4);

    expect(emit).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    hostClosed.next();
    expect(navigate).toHaveBeenCalledWith(['/quality/recalls'], { queryParams: { detail: 'recall:4' } });
  });

  it('navigates straight to the recall outside a dialog', () => {
    const { panel, navigate } = setup();

    panel.openRecall(4);

    expect(navigate).toHaveBeenCalledWith(['/quality/recalls'], { queryParams: { detail: 'recall:4' } });
  });

  it('loads the lot files when attachments are on', () => {
    const { panel, getFiles } = setup({ attachmentsEnabled: true });

    expect(panel.canAttachFiles()).toBe(true);
    expect(getFiles).toHaveBeenCalledWith(1);
    expect(panel.files().map(f => f.fileName)).toEqual(['mill-cert.pdf']);
  });

  it('does not ask for files when attachments are off', () => {
    const { panel, getFiles } = setup();

    expect(panel.canAttachFiles()).toBe(false);
    expect(getFiles).not.toHaveBeenCalled();
  });

  it('reloads the files after an upload', () => {
    const { panel, getFiles, success } = setup({ attachmentsEnabled: true });

    panel.onFileUploaded();

    expect(getFiles).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledWith('lots.fileUploaded');
  });

  it('deletes a file once the delete is confirmed', () => {
    const { panel, deleteFile, success } = setup({ attachmentsEnabled: true, dialogResult: true });

    panel.deleteFile(CERT);

    expect(deleteFile).toHaveBeenCalledWith(31);
    expect(panel.files()).toEqual([]);
    expect(success).toHaveBeenCalledWith('lots.fileDeleted');
  });
});

describe('LotDetailPanelComponent editing', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lets the lot roles edit and reloads the trace after a save', () => {
    const { panel, trace } = setup({ roles: ['ProductionWorker'] });
    expect(panel.canEdit).toBe(true);

    panel.openEdit();
    expect(panel.editing()).toBe(true);
    panel.onLotSaved();

    expect(panel.editing()).toBe(false);
    expect(trace).toHaveBeenCalledTimes(2);
  });

  it('offers no edit to a role the lots API refuses', () => {
    expect(setup({ roles: ['OfficeManager'] }).panel.canEdit).toBe(false);
  });
});

