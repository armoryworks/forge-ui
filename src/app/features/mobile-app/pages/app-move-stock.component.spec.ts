import { Signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { OnHand, ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { CapabilityService } from '../../../shared/services/capability.service';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { markHttpErrorShown } from '../../../shared/utils/shown-http-errors';
import { AppMoveStockComponent } from './app-move-stock.component';

interface MoveInternals {
  step: Signal<string>;
  notice: Signal<string | null>;
  quantity: WritableSignal<number>;
  lot: Signal<string | null>;
  noLot: Signal<boolean>;
  canFinish: Signal<boolean>;
  leftBehind: Signal<number | null>;
  part: Signal<ScanResolveResult | null>;
  from: Signal<ScanResolveResult | null>;
  typedQuantity: { setValue(value: number | null): void; value: number | null };
  submitManual(code: string): Promise<void>;
  finish(): void;
  bump(delta: number): void;
}

const part: ScanResolveResult = { kind: 'part', id: 6, code: 'PRT-HW-INS-M4', label: 'HW-INS-M4', subtitle: null };
const fromBin: ScanResolveResult = { kind: 'bin', id: 11, code: 'LOC-A2', label: 'A2', subtitle: null };
const toBin: ScanResolveResult = { kind: 'bin', id: 12, code: 'LOC-A3', label: 'A3', subtitle: null };
const lotB: ScanResolveResult = {
  kind: 'lot', id: 30, code: 'LOT-B', label: 'LOT-B', subtitle: null, partId: 6, partNumber: 'HW-INS-M4',
};

function stock(overrides: Partial<OnHand>): OnHand {
  return {
    partId: 6, partNumber: 'HW-INS-M4', locationId: 11, locationName: 'A2',
    quantity: 10, lotTracked: false, lots: [], unlottedQuantity: 10, ...overrides,
  };
}

describe('AppMoveStockComponent', () => {
  const api = { resolveScan: vi.fn(), onHand: vi.fn(), moveStock: vi.fn() };
  const feedback = { tick: vi.fn(), doubleBuzz: vi.fn() };
  const snackbar = { error: vi.fn() };

  function create(): MoveInternals {
    return TestBed.runInInjectionContext(() => new AppMoveStockComponent()) as unknown as MoveInternals;
  }

  async function scanAll(move: MoveInternals): Promise<void> {
    await move.submitManual(part.code);
    await move.submitManual(fromBin.code);
    await move.submitManual(toBin.code);
  }

  beforeEach(() => {
    api.resolveScan.mockReset().mockImplementation((code: string) =>
      of([part, fromBin, toBin, lotB].find((r) => r.code === code)));
    api.onHand.mockReset().mockReturnValue(of(stock({})));
    feedback.tick.mockReset();
    feedback.doubleBuzz.mockReset();
    snackbar.error.mockReset();
    api.moveStock.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: CameraScannerService, useValue: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() } },
        { provide: MobileApiService, useValue: api },
        { provide: ScanFeedbackService, useValue: feedback },
        { provide: UndoService, useValue: { offer: vi.fn() } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SharedIdentityService, useValue: { identified: () => false, touch: vi.fn() } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared: false }) } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
      ],
    });
  });

  it('refuses a from-bin that does not hold the part and stays on that step', async () => {
    api.onHand.mockReturnValue(of(stock({ quantity: 0, unlottedQuantity: 0 })));
    const move = create();

    await move.submitManual(part.code);
    await move.submitManual(fromBin.code);

    expect(move.step()).toBe('from');
    expect(move.notice()).toBe('mobileApp.move.notInBin');
    expect(feedback.doubleBuzz).toHaveBeenCalledOnce();
  });

  it('offers stock put away without a lot for a lot-tracked part, and picks it when it is all there is', async () => {
    api.onHand.mockReturnValue(of(stock({ lotTracked: true, quantity: 10000, lots: [], unlottedQuantity: 10000 })));
    const move = create();

    await scanAll(move);

    expect(move.step()).toBe('quantity');
    expect(move.noLot()).toBe(true);
    expect(move.quantity()).toBe(10000);
    expect(move.canFinish()).toBe(true);
  });

  it('waits for a lot choice when lotted and unlotted stock share the bin', async () => {
    api.onHand.mockReturnValue(of(stock({
      lotTracked: true, quantity: 15, lots: [{ lotNumber: 'LOT-A', quantity: 10 }], unlottedQuantity: 5,
    })));
    const move = create();

    await scanAll(move);

    expect(move.lot()).toBeNull();
    expect(move.noLot()).toBe(false);
    expect(move.canFinish()).toBe(false);
  });

  it('moves whole units only and says what stays behind', async () => {
    api.onHand.mockReturnValue(of(stock({ quantity: 12.5, unlottedQuantity: 12.5 })));
    const move = create();

    await scanAll(move);

    expect(move.quantity()).toBe(12);
    expect(move.leftBehind()).toBe(0.5);
    move.quantity.set(2.5);
    expect(move.canFinish()).toBe(false);
    move.quantity.set(13);
    expect(move.canFinish()).toBe(false);
    move.quantity.set(3);
    expect(move.canFinish()).toBe(true);
  });

  it('takes the part and lot from a scanned lot and picks that lot', async () => {
    api.onHand.mockReturnValue(of(stock({
      lotTracked: true, quantity: 15, lots: [{ lotNumber: 'LOT-A', quantity: 10 }, { lotNumber: 'LOT-B', quantity: 5 }], unlottedQuantity: 0,
    })));
    const move = create();

    await move.submitManual(lotB.code);
    expect(move.part()).toEqual(expect.objectContaining({ kind: 'part', id: 6, label: 'HW-INS-M4' }));
    expect(move.step()).toBe('from');

    await move.submitManual(fromBin.code);
    await move.submitManual(toBin.code);

    expect(move.lot()).toBe('LOT-B');
    expect(move.quantity()).toBe(5);
  });

  it('keeps a bin scanned first as the from-bin and skips that step once the part is scanned', async () => {
    const move = create();

    await move.submitManual(fromBin.code);
    expect(move.step()).toBe('part');
    expect(move.from()).toEqual(fromBin);

    await move.submitManual(part.code);

    expect(move.step()).toBe('to');
    expect(api.onHand).toHaveBeenCalledWith(6, 11);
  });

  it('asks for the from-bin again when the bin scanned first does not hold the part', async () => {
    api.onHand.mockReturnValue(of(stock({ quantity: 0, unlottedQuantity: 0 })));
    const move = create();

    await move.submitManual(fromBin.code);
    await move.submitManual(part.code);

    expect(move.step()).toBe('from');
    expect(move.from()).toBeNull();
    expect(move.notice()).toBe('mobileApp.move.notInBin');
  });

  it('holds a typed quantity to between 1 and what can move', async () => {
    const move = create();
    await scanAll(move);

    move.typedQuantity.setValue(40);
    expect(move.quantity()).toBe(10);
    expect(move.typedQuantity.value).toBe(10);

    move.typedQuantity.setValue(0);
    expect(move.quantity()).toBe(1);

    move.typedQuantity.setValue(4);
    expect(move.quantity()).toBe(4);
  });

  it('does not repeat a refusal the server already explained', async () => {
    const refusal = { status: 409 };
    markHttpErrorShown(refusal);
    api.moveStock.mockReturnValue(throwError(() => refusal));
    const move = create();
    await scanAll(move);

    move.finish();
    await vi.waitFor(() => expect(api.moveStock).toHaveBeenCalled());
    await Promise.resolve();

    expect(snackbar.error).not.toHaveBeenCalled();
  });

  it('says the move failed when nothing explained it yet', async () => {
    api.moveStock.mockReturnValue(throwError(() => new Error('offline')));
    const move = create();
    await scanAll(move);

    move.finish();

    await vi.waitFor(() => expect(snackbar.error).toHaveBeenCalledWith('mobileApp.move.failed'));
  });
});
