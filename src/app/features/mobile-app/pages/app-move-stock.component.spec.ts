import { Signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { OnHand, ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { AppMoveStockComponent } from './app-move-stock.component';

interface MoveInternals {
  step: Signal<string>;
  notice: Signal<string | null>;
  quantity: WritableSignal<number>;
  lot: Signal<string | null>;
  noLot: Signal<boolean>;
  canFinish: Signal<boolean>;
  leftBehind: Signal<number | null>;
  submitManual(code: string): Promise<void>;
  bump(delta: number): void;
}

const part: ScanResolveResult = { kind: 'part', id: 6, code: 'PRT-HW-INS-M4', label: 'HW-INS-M4', subtitle: null };
const fromBin: ScanResolveResult = { kind: 'bin', id: 11, code: 'LOC-A2', label: 'A2', subtitle: null };
const toBin: ScanResolveResult = { kind: 'bin', id: 12, code: 'LOC-A3', label: 'A3', subtitle: null };

function stock(overrides: Partial<OnHand>): OnHand {
  return {
    partId: 6, partNumber: 'HW-INS-M4', locationId: 11, locationName: 'A2',
    quantity: 10, lotTracked: false, lots: [], unlottedQuantity: 10, ...overrides,
  };
}

describe('AppMoveStockComponent', () => {
  const api = { resolveScan: vi.fn(), onHand: vi.fn(), moveStock: vi.fn() };
  const feedback = { tick: vi.fn(), doubleBuzz: vi.fn() };

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
      of([part, fromBin, toBin].find((r) => r.code === code)));
    api.onHand.mockReset().mockReturnValue(of(stock({})));
    feedback.tick.mockReset();
    feedback.doubleBuzz.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: CameraScannerService, useValue: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() } },
        { provide: MobileApiService, useValue: api },
        { provide: ScanFeedbackService, useValue: feedback },
        { provide: UndoService, useValue: { offer: vi.fn() } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: SnackbarService, useValue: { error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SharedIdentityService, useValue: { identified: () => false, touch: vi.fn() } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared: false }) } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
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
});
