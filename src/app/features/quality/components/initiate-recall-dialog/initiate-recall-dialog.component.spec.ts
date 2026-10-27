import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { InitiateRecallDialogComponent, InitiateRecallDialogData } from './initiate-recall-dialog.component';
import { RecallService } from '../../services/recall.service';
import { RecallImpactPreview } from '../../models/recall-impact-preview.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DialogApi {
  preview(): RecallImpactPreview | null;
  previewLoading(): boolean;
  previewFailed(): boolean;
  previewCustomers(): string[];
  downstreamLotCount(): number;
  form: { controls: { lotId: { setValue(v: number | null): void }; reason: { setValue(v: string): void } } };
  confirm(): void;
}

const PREVIEW: RecallImpactPreview = {
  initiatedLotId: 7, initiatedLotNumber: 'LOT-7', affectedLotsCount: 3, affectedShipmentsCount: 2, affectedCustomersCount: 2,
  totalQuarantineQuantity: 40,
  affectedLots: [],
  affectedShipments: [
    { shipmentId: 1, shipmentNumber: 'SH-1', customerId: 2, customerName: 'Zeta Foods', affectedQuantity: 5, shippedDate: null, trackingNumber: null, isApproximate: false },
    { shipmentId: 2, shipmentNumber: 'SH-2', customerId: 3, customerName: 'Acme Labs', affectedQuantity: 5, shippedDate: null, trackingNumber: null, isApproximate: false },
  ],
};

function setup(data: InitiateRecallDialogData, previewRecall: ReturnType<typeof vi.fn>) {
  const initiateRecall = vi.fn(() => of({ id: 9 }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: RecallService, useValue: { previewRecall, initiateRecall } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const dialog = TestBed.runInInjectionContext(() => new InitiateRecallDialogComponent()) as unknown as DialogApi;
  return { dialog, initiateRecall };
}

describe('InitiateRecallDialogComponent impact preview', () => {
  it('previews the impact of the lot it was opened on before the recall starts', () => {
    const previewRecall = vi.fn(() => of(PREVIEW));
    const { dialog } = setup({ lotId: 7, lotNumber: 'LOT-7' }, previewRecall);

    expect(previewRecall).toHaveBeenCalledWith(7);
    expect(dialog.preview()).toEqual(PREVIEW);
    expect(dialog.downstreamLotCount()).toBe(2);
    expect(dialog.previewCustomers()).toEqual(['Acme Labs', 'Zeta Foods']);
  });

  it('previews again when a different lot is picked', () => {
    const previewRecall = vi.fn(() => of(PREVIEW));
    const { dialog } = setup({ lotId: null, lotNumber: null }, previewRecall);
    expect(previewRecall).not.toHaveBeenCalled();

    dialog.form.controls.lotId.setValue(12);

    expect(previewRecall).toHaveBeenCalledWith(12);
  });

  it('does not start the recall while the preview is still loading', () => {
    const pending = new Subject<RecallImpactPreview>();
    const { dialog, initiateRecall } = setup({ lotId: 7, lotNumber: 'LOT-7' }, vi.fn(() => pending));
    dialog.form.controls.reason.setValue('Contaminated resin');

    expect(dialog.previewLoading()).toBe(true);
    dialog.confirm();
    expect(initiateRecall).not.toHaveBeenCalled();

    pending.next(PREVIEW);
    dialog.confirm();
    expect(initiateRecall).toHaveBeenCalled();
  });

  it('still lets the recall start when the preview fails', () => {
    const { dialog, initiateRecall } = setup({ lotId: 7, lotNumber: 'LOT-7' }, vi.fn(() => throwError(() => new Error('boom'))));
    dialog.form.controls.reason.setValue('Contaminated resin');

    expect(dialog.previewFailed()).toBe(true);
    dialog.confirm();
    expect(initiateRecall).toHaveBeenCalled();
  });
});
