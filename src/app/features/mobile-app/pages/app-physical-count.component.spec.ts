import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { AppPhysicalCountComponent } from './app-physical-count.component';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { MobilePhysicalCountService } from '../../../shared/services/mobile-physical-count.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';

interface PageInternals {
  inventory(): { id: number } | null;
  inventories(): unknown[];
  tag(): { id: number; status: string } | null;
  notice(): string | null;
  tagNumberControl: { setValue(v: number): void };
  quantityControl: { setValue(v: number): void };
  lookUp(): Promise<void>;
  save(): Promise<void>;
}

const tag = (status: string) => ({
  id: 41, physicalInventoryId: 7, tagNumber: 12, locationName: 'Rack 1', partNumber: 'P-3', lotNumber: null,
  frozenQuantity: null, countedQuantity: null, status,
});

describe('AppPhysicalCountComponent', () => {
  const api = { counting: vi.fn(), tag: vi.fn(), count: vi.fn() };

  async function create(): Promise<PageInternals> {
    TestBed.configureTestingModule({
      providers: [
        { provide: MobilePhysicalCountService, useValue: api },
        { provide: CameraScannerService, useValue: { start: vi.fn(), stop: vi.fn() } },
        { provide: ScanFeedbackService, useValue: { tick: vi.fn(), doubleBuzz: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new AppPhysicalCountComponent()) as unknown as PageInternals;
    await Promise.resolve();
    await Promise.resolve();
    return page;
  }

  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.counting.mockReturnValue(of([
      { id: 7, inventoryNumber: 'PI-000007', status: 'Counting' },
      { id: 8, inventoryNumber: 'PI-000008', status: 'Posted' },
    ]));
  });

  it('picks the one count in progress', async () => {
    const page = await create();
    expect(page.inventories()).toHaveLength(1);
    expect(page.inventory()?.id).toBe(7);
  });

  it('finds a tag, saves the count and clears for the next tag', async () => {
    api.tag.mockReturnValue(of(tag('Open')));
    api.count.mockReturnValue(of({ ...tag('Counted'), countedQuantity: 6 }));
    const page = await create();
    page.tagNumberControl.setValue(12);
    await page.lookUp();
    expect(api.tag).toHaveBeenCalledWith(7, 12);

    page.quantityControl.setValue(6);
    await page.save();

    expect(api.count).toHaveBeenCalledWith(7, 41, 6);
    expect(page.tag()).toBeNull();
    expect(page.notice()).toBe('mobileApp.physicalCount.saved');
  });

  it('keeps the tag open when the count asks for a recount', async () => {
    api.tag.mockReturnValue(of(tag('Open')));
    api.count.mockReturnValue(of(tag('RecountRequired')));
    const page = await create();
    page.tagNumberControl.setValue(12);
    await page.lookUp();
    page.quantityControl.setValue(1);
    await page.save();
    expect(page.tag()?.status).toBe('RecountRequired');
    expect(page.notice()).toBe('mobileApp.physicalCount.recountAsked');
  });
});
