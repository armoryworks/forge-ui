import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { RfqDialogComponent } from './rfq-dialog.component';
import { PurchasingService } from '../../services/purchasing.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CreateRfqRequest, RfqListItem } from '../../models/rfq.model';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';

class EmptyLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogApi {
  form: FormGroup;
  save(): void;
  ngOnInit(): void;
  ngAfterViewInit(): void;
  partPicker?: { setSelected(id: number, text: string): void };
}

const rfq: RfqListItem = {
  id: 7,
  rfqNumber: 'RFQ-0007',
  partId: 3,
  partNumber: 'PRT-3',
  partDescription: 'Bracket',
  quantity: 25,
  requiredDate: '2026-11-20T00:00:00Z',
  status: 'Draft',
  description: null,
  specialInstructions: null,
  responseDeadline: '2026-11-13T00:00:00Z',
  sentAt: null,
  awardedAt: null,
  awardedVendorResponseId: null,
  generatedPurchaseOrderId: null,
  notes: null,
  vendorResponseCount: 0,
  receivedResponseCount: 0,
  createdAt: '2026-11-01T15:04:00Z',
};

describe('RfqDialogComponent date-only fields west of UTC', () => {
  let originalTz: string | undefined;
  let updateRfq: ReturnType<typeof vi.fn>;

  function create(existing: RfqListItem | null): DialogApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PurchasingService, useValue: { updateRfq, createRfq: vi.fn(() => of({})) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(RfqDialogComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(RfqDialogComponent);
    fixture.componentRef.setInput('rfq', existing);
    const api = fixture.componentInstance as unknown as DialogApi;
    api.ngOnInit();
    return api;
  }

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
    updateRfq = vi.fn((_id: number, _request: CreateRfqRequest) => of(void 0));
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it('loads the stored calendar day into the form', () => {
    const api = create(rfq);
    const required = api.form.controls['requiredDate'].value as Date;

    expect([required.getFullYear(), required.getMonth(), required.getDate()]).toEqual([2026, 10, 20]);
  });

  it('re-saves an untouched RFQ with the same dates', () => {
    const api = create(rfq);

    api.save();

    expect(updateRfq).toHaveBeenCalledTimes(1);
    const request = updateRfq.mock.calls[0][1] as CreateRfqRequest;
    expect(request.requiredDate).toBe('2026-11-20T00:00:00Z');
    expect(request.responseDeadline).toBe('2026-11-13T00:00:00Z');
  });

  it('shows the stored part in the part search box when editing', () => {
    const api = create(rfq);
    const setSelected = vi.fn();
    api.partPicker = { setSelected };

    api.ngAfterViewInit();

    expect(setSelected).toHaveBeenCalledWith(3, 'PRT-3');
    expect(api.form.controls['partId'].value).toBe(3);
  });

  it('leaves the part search box empty for a new RFQ', () => {
    const api = create(null);
    const setSelected = vi.fn();
    api.partPicker = { setSelected };

    api.ngAfterViewInit();

    expect(setSelected).not.toHaveBeenCalled();
  });
});

describe('RfqDialogComponent part picker', () => {
  let httpMock: HttpTestingController;

  interface PickerInternals {
    searchControl: { value: string; setValue(value: string): void };
  }

  function render(existing: RfqListItem | null) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RfqDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: EmptyLoader } }),
        { provide: PurchasingService, useValue: { updateRfq: vi.fn(() => of(void 0)), createRfq: vi.fn(() => of({})) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RfqDialogComponent);
    fixture.componentRef.setInput('rfq', existing);
    fixture.detectChanges();
    const picker = fixture.debugElement.query(By.directive(EntityPickerComponent)).componentInstance as EntityPickerComponent;
    return { fixture, picker, internals: picker as unknown as PickerInternals };
  }

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('searches only parts that are not obsolete for a new RFQ', () => {
    vi.useFakeTimers();
    const { internals } = render(null);

    internals.searchControl.setValue('BR');
    vi.advanceTimersByTime(300);

    const req = httpMock.expectOne(r => r.url === '/api/v1/parts');
    expect(req.request.params.get('isActive')).toBe('true');
    req.flush({ items: [], totalCount: 0 });
  });

  it('still shows the stored part when editing an RFQ whose part is now obsolete', () => {
    const { fixture, internals } = render({ ...rfq, partId: 9, partNumber: 'PRT-OBS-9' });

    expect(internals.searchControl.value).toBe('PRT-OBS-9');
    expect((fixture.componentInstance as unknown as DialogApi).form.controls['partId'].value).toBe(9);
    httpMock.expectNone(() => true);
  });
});
