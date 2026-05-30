import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

import { mockSignalInputs } from '../../../../../../testing/signal-input-harness';
import { PartPurchaseOptionsClusterComponent } from './part-purchase-options-cluster.component';
import { PurchaseOptionsService } from '../../../services/purchase-options.service';
import { InventoryService } from '../../../../inventory/services/inventory.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { PartPurchaseOption } from '../../../models/part-purchase-option.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function opt(over: Partial<PartPurchaseOption> = {}): PartPurchaseOption {
  return {
    id: 1, partId: 7, label: '4x8 sheet', contentQuantity: 32,
    contentUomId: null, contentUomCode: null, contentUomLabel: null,
    sortOrder: 0, isActive: true, ...over,
  };
}

describe('PartPurchaseOptionsClusterComponent', () => {
  let service: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn().mockReturnValue(of([opt()])),
      create: vi.fn().mockReturnValue(of(opt({ id: 2, label: 'bag of 100', contentQuantity: 100 }))),
      update: vi.fn().mockReturnValue(of(opt())),
      delete: vi.fn().mockReturnValue(of(void 0)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PartPurchaseOptionsClusterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PurchaseOptionsService, useValue: service },
        { provide: InventoryService, useValue: { getUnitsOfMeasure: () => of([{ id: 1, name: 'Square Foot', symbol: 'sqft', isActive: true, category: 'Area' }]) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
      ],
    });
  });

  it('loads the part purchase options on init', () => {
    const c = TestBed.runInInjectionContext(() => new PartPurchaseOptionsClusterComponent());
    mockSignalInputs(c, { partId: 7, editing: true });
    TestBed.flushEffects();
    const x = c as unknown as { options(): PartPurchaseOption[] };
    expect(service.list).toHaveBeenCalledWith(7);
    expect(x.options().length).toBe(1);
  });

  it('creates a new option via the service on save', () => {
    const c = TestBed.runInInjectionContext(() => new PartPurchaseOptionsClusterComponent());
    mockSignalInputs(c, { partId: 7, editing: true });
    TestBed.flushEffects();
    const x = c as unknown as {
      startAdd(): void;
      form: { patchValue(v: Record<string, unknown>): void };
      saveRow(): void;
    };
    x.startAdd();
    x.form.patchValue({ label: 'bag of 100', contentQuantity: 100, contentUomId: null });
    x.saveRow();
    expect(service.create).toHaveBeenCalledWith(7, expect.objectContaining({ label: 'bag of 100', contentQuantity: 100 }));
  });
});
