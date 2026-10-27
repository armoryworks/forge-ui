import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { LabelPrintService } from '../../../../shared/services/label-print.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SchedulingService } from '../../../scheduling/services/scheduling.service';
import { ReplenishmentCardService } from '../../services/replenishment-card.service';
import { ReplenishmentCard } from '../../models/replenishment-card.model';
import { ReplenishmentCardsComponent } from './replenishment-cards.component';

interface CardsInternals {
  canEdit: boolean;
  cards(): ReplenishmentCard[];
  waitingCount(): number;
  canTrigger(card: ReplenishmentCard): boolean;
  awaitingRefill(card: ReplenishmentCard): boolean;
  trigger(card: ReplenishmentCard): void;
  scanControl: FormControl<string>;
  scan(): void;
  openConfirm(card: ReplenishmentCard): void;
  confirmRefill(): void;
  print(card: ReplenishmentCard): void;
  openDetail(card: ReplenishmentCard): void;
  openCreate(): void;
  openEdit(card: ReplenishmentCard): void;
  cardForm: FormGroup<Record<string, FormControl<unknown>>>;
  saveCard(): void;
}

function card(overrides: Partial<ReplenishmentCard> = {}): ReplenishmentCard {
  return {
    id: 3, cardNumber: 'KB-0003', partId: 10, partNumber: 'BRK-10', partDescription: 'Bracket', workCenterId: 2, workCenterName: 'Press',
    storageLocationId: 5, storageLocationName: 'A1', binQuantity: 50, numberOfBins: 2, status: 'Full', supplySource: 'Purchase',
    supplyVendorId: 8, supplyVendorName: 'Vendor', supplyWorkCenterId: null, leadTimeDays: 3, lastTriggeredAt: null,
    lastReplenishedAt: null, activeOrderId: null, activeOrderType: null, triggerCount: 0, isActive: true,
    ...overrides,
  };
}

function setup(roles: string[] = ['Manager'], list: ReplenishmentCard[] = [card(), card({ id: 4, cardNumber: 'KB-0004', status: 'Triggered' })]) {
  const service = {
    getCards: vi.fn(() => of({ data: list, page: 1, pageSize: 100, totalCount: list.length, totalPages: 1 })),
    getCard: vi.fn(() => of({ card: list[0], triggerLogs: [] })),
    trigger: vi.fn(() => of(undefined)),
    confirm: vi.fn(() => of(undefined)),
    create: vi.fn(() => of(card())),
    update: vi.fn((_id: number, _request: Record<string, unknown>) => of(card())),
  };
  const printLabels = vi.fn(() => Promise.resolve());
  const snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ReplenishmentCardService, useValue: service },
      { provide: SchedulingService, useValue: { getWorkCenters: vi.fn(() => of([])) } },
      { provide: LabelPrintService, useValue: { printLabels } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: snackbar },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: CapabilityService, useValue: { isEnabled: () => true } },
    ],
  });
  const c = TestBed.runInInjectionContext(() => new ReplenishmentCardsComponent()) as unknown as CardsInternals;
  return { c, service, printLabels, snackbar };
}

describe('ReplenishmentCardsComponent', () => {
  it('lists the cards and counts those waiting for replenishment', () => {
    const { c, service } = setup();

    expect(service.getCards).toHaveBeenCalledWith(null);
    expect(c.cards().length).toBe(2);
    expect(c.waitingCount()).toBe(1);
  });

  it('marks a full card empty, and confirms the refill of a waiting one', () => {
    const { c, service } = setup();
    const full = c.cards()[0];
    const waiting = c.cards()[1];

    expect(c.canTrigger(full)).toBe(true);
    expect(c.canTrigger(waiting)).toBe(false);
    expect(c.awaitingRefill(waiting)).toBe(true);
    c.trigger(full);
    expect(service.trigger).toHaveBeenCalledWith(3, 'Manual');

    c.openConfirm(waiting);
    c.confirmRefill();
    expect(service.confirm).toHaveBeenCalledWith(4, 50);
  });

  it('triggers by scanning the card number, and says so when the card is unknown', () => {
    const { c, service, snackbar } = setup();

    c.scanControl.setValue('kb-0003');
    c.scan();
    expect(service.trigger).toHaveBeenCalledWith(3, 'Scan');

    c.scanControl.setValue('KB-9999');
    c.scan();
    expect(snackbar.error).toHaveBeenCalled();
  });

  it('prints one barcode label per container', () => {
    const { c, printLabels } = setup();

    c.print(c.cards()[0]);

    expect(printLabels).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'barcode', value: 'KB-0003' }),
      expect.objectContaining({ type: 'barcode', value: 'KB-0003' }),
    ]);
  });

  it('lets only Admin and Manager create and edit cards', () => {
    expect(setup(['Manager']).c.canEdit).toBe(true);
    expect(setup(['Engineer']).c.canEdit).toBe(false);
    expect(setup(['ProductionWorker']).c.canEdit).toBe(false);
  });

  it('creates a purchase card with its vendor and no supplying work center', () => {
    const { c, service } = setup();
    c.openCreate();
    c.cardForm.patchValue({ partId: 10, workCenterId: 2, binQuantity: 25, supplyVendorId: 8, supplyWorkCenterId: 4 });

    c.saveCard();

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
      partId: 10, workCenterId: 2, binQuantity: 25, numberOfBins: 2, supplySource: 'Purchase', supplyVendorId: 8, supplyWorkCenterId: null,
    }));
  });

  it('edits a card without changing its part or work center', () => {
    const { c, service } = setup();
    c.openEdit(c.cards()[0]);
    c.cardForm.patchValue({ binQuantity: 60, isActive: false });

    c.saveCard();

    expect(service.update).toHaveBeenCalledWith(3, expect.objectContaining({ binQuantity: 60, isActive: false }));
    expect(service.update.mock.calls[0][1]).not.toHaveProperty('partId');
  });
});
