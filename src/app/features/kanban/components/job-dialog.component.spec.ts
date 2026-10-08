import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable, Subject, of, throwError } from 'rxjs';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { JobDialogComponent } from './job-dialog.component';
import { KanbanService } from '../services/kanban.service';
import { SalesOrderService } from '../../sales-orders/services/sales-order.service';
import { PartsService } from '../../parts/services/parts.service';
import { ManualNumberSettingsService } from '../../../shared/services/manual-number-settings.service';
import { AssignableSalesOrderLine } from '../models/assignable-sales-order-line.model';
import { JobDetail } from '../models/job-detail.model';
import { TrackType } from '../../../shared/models/track-type.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  jobForm: FormGroup<{
    title: FormControl<string | null>;
    customerId: FormControl<number | null>;
    dueDate: FormControl<Date | null>;
    salesOrderLineId: FormControl<number | null>;
    partId: FormControl<number | null>;
    quantity: FormControl<number | null>;
    trackTypeId: FormControl<number | null>;
    initialStageId: FormControl<number | null>;
  }>;
  filledFromSoLine: () => boolean;
  startStageOptions: () => { value: unknown }[];
  partLabel: () => { id: number; text: string } | null;
  draftConfig: { restoreFn?: (data: Record<string, unknown>) => void };
  onSubmit(): void;
}

const trackTypes = [{ id: 1, name: 'Production', isDefault: true, stages: [] }] as unknown as TrackType[];

const stagedTrackTypes = [
  {
    id: 1, name: 'Production', isDefault: true,
    stages: [
      { id: 13, name: 'Order Confirmed', code: 'order_confirmed', sortOrder: 3 },
      { id: 11, name: 'Quote Requested', code: 'quote_requested', sortOrder: 1 },
      { id: 14, name: 'Materials Ordered', code: 'materials_ordered', sortOrder: 4 },
      { id: 15, name: 'Shipped', code: 'shipped', sortOrder: 5, isMandatory: true },
      { id: 16, name: 'Invoiced/Sent', code: 'invoiced_sent', sortOrder: 6, isMandatory: true },
      { id: 17, name: 'Payment Received', code: 'payment_received', sortOrder: 7 },
    ],
  },
  {
    id: 3, name: 'R&D', isDefault: false,
    stages: [
      { id: 31, name: 'Concept', code: 'concept', sortOrder: 1 },
      { id: 32, name: 'Prototype', code: 'prototype', sortOrder: 2 },
      { id: 33, name: 'Production Ready', code: 'production_ready', sortOrder: 3 },
    ],
  },
  {
    id: 2, name: 'Maintenance', isDefault: false,
    stages: [{ id: 21, name: 'Requested', code: 'requested', sortOrder: 1 }],
  },
] as unknown as TrackType[];

const documentTrackTypes = [
  {
    id: 1, name: 'Production', isDefault: true,
    stages: [
      { id: 11, name: 'Quote Requested', code: 'quote_requested', sortOrder: 1, accountingDocumentType: null },
      { id: 12, name: 'In Review', code: 'in_review', sortOrder: 2, accountingDocumentType: null },
      { id: 13, name: 'Quoted', code: 'quoted', sortOrder: 3, accountingDocumentType: 'Estimate' },
      { id: 14, name: 'Order Confirmed', code: 'order_confirmed', sortOrder: 4, accountingDocumentType: 'SalesOrder' },
      { id: 15, name: 'Materials Ordered', code: 'materials_ordered', sortOrder: 5, accountingDocumentType: 'PurchaseOrder' },
      { id: 16, name: 'Shipped', code: 'shipped', sortOrder: 6, isMandatory: true, accountingDocumentType: 'Invoice' },
      { id: 17, name: 'Payment Received', code: 'payment_received', sortOrder: 7, accountingDocumentType: 'Payment' },
    ],
  },
] as unknown as TrackType[];

function soLine(overrides: Partial<AssignableSalesOrderLine> = {}): AssignableSalesOrderLine {
  return {
    id: 40,
    salesOrderId: 9,
    orderNumber: 'SO-1009',
    lineNumber: 1,
    partId: 12,
    partNumber: 'BRK-100',
    description: 'Mounting bracket',
    quantity: 600,
    assignedJobCount: 0,
    remainingQuantity: 500,
    requestedDeliveryDate: '2026-10-07T00:00:00Z',
    ...overrides,
  };
}

describe('JobDialogComponent', () => {
  let fixture: ComponentFixture<JobDialogComponent>;
  let component: DialogInternals;
  let createJob: ReturnType<typeof vi.fn>;
  let updateJob: ReturnType<typeof vi.fn>;
  let getSalesOrderById: ReturnType<typeof vi.fn>;
  let getPartById: ReturnType<typeof vi.fn>;
  const parts: Record<number, { id: number; partNumber: string; name: string }> = {
    12: { id: 12, partNumber: 'BRK-100', name: 'Bracket, mounting' },
    13: { id: 13, partNumber: 'PLT-7', name: 'Plate, base' },
    99: { id: 99, partNumber: 'SPC-99', name: 'Spacer' },
  };
  let lines: AssignableSalesOrderLine[];

  function render(mode: 'create' | 'edit', job: JobDetail | null = null, types: TrackType[] = trackTypes): void {
    fixture = TestBed.createComponent(JobDialogComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('trackTypes', types);
    fixture.componentRef.setInput('job', job);
    fixture.detectChanges();
    component = fixture.componentInstance as unknown as DialogInternals;
  }

  beforeEach(() => {
    lines = [soLine()];
    createJob = vi.fn(() => new Subject());
    updateJob = vi.fn(() => new Subject());
    getSalesOrderById = vi.fn((id: number) => of(id === 9
      ? { id: 9, customerId: 77, requestedDeliveryDate: '2026-11-02T00:00:00Z' }
      : { id, customerId: 88, requestedDeliveryDate: '2026-12-01T00:00:00Z' }));
    getPartById = vi.fn((id: number) => parts[id] ? of(parts[id]) : throwError(() => new Error('not found')));

    TestBed.configureTestingModule({
      imports: [JobDialogComponent],
      providers: [
        {
          provide: KanbanService,
          useValue: {
            getCustomers: () => of([]),
            getUsers: () => of([]),
            getAssignableSalesOrderLines: () => of(lines),
            createJob,
            updateJob,
          },
        },
        { provide: SalesOrderService, useValue: { getSalesOrderById } },
        { provide: PartsService, useValue: { getPartById } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    TestBed.overrideComponent(JobDialogComponent, { set: { template: '' } });
  });

  it('enables quantity only once a part is chosen, defaulting to 1', () => {
    render('create');
    const { partId, quantity } = component.jobForm.controls;

    expect(quantity.disabled).toBe(true);

    partId.setValue(12);
    expect(quantity.enabled).toBe(true);
    expect(quantity.value).toBe(1);

    partId.setValue(null);
    expect(quantity.disabled).toBe(true);
  });

  it('sends part and quantity together on create', () => {
    render('create');
    const f = component.jobForm.controls;
    f.title.setValue('Bracket run');
    f.partId.setValue(12);
    f.quantity.setValue(500);

    component.onSubmit();

    expect(createJob).toHaveBeenCalledOnce();
    const payload = createJob.mock.calls[0][0];
    expect(payload.partId).toBe(12);
    expect(payload.quantity).toBe(500);
  });

  it('does not send a quantity without a part', () => {
    render('create');
    component.jobForm.controls.title.setValue('Internal fixture');

    component.onSubmit();

    const payload = createJob.mock.calls[0][0];
    expect(payload.partId).toBeNull();
    expect(payload.quantity).toBeNull();
  });

  it('fills part, remaining quantity, title, customer and due date from a picked SO line', () => {
    lines = [soLine({ requestedDeliveryDate: null })];
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);

    expect(f.partId.value).toBe(12);
    expect(f.quantity.value).toBe(500);
    expect(f.title.value).toBe('BRK-100 — Bracket, mounting');
    expect(f.customerId.value).toBe(77);
    const due = f.dueDate.value!;
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2026, 10, 2]);
    expect(component.filledFromSoLine()).toBe(true);
  });

  it('keeps values the user already entered when an SO line is picked', () => {
    render('create');
    const f = component.jobForm.controls;
    f.title.setValue('Rush order');
    f.partId.setValue(99);
    f.quantity.setValue(25);
    f.quantity.markAsDirty();
    f.customerId.setValue(5);
    f.dueDate.setValue(new Date(2026, 9, 20));

    f.salesOrderLineId.setValue(40);

    expect(f.title.value).toBe('Rush order');
    expect(f.partId.value).toBe(99);
    expect(f.quantity.value).toBe(25);
    expect(f.customerId.value).toBe(5);
    expect(f.dueDate.value!.getDate()).toBe(20);
    expect(getSalesOrderById).not.toHaveBeenCalled();
  });

  it('falls back to the line description in the title when the part cannot be loaded', () => {
    getPartById.mockReturnValue(throwError(() => new Error('offline')));
    render('create');

    component.jobForm.controls.salesOrderLineId.setValue(40);

    expect(component.jobForm.controls.title.value).toBe('BRK-100 — Mounting bracket');
  });

  it('replaces everything it filled from the first line when a different line is picked', () => {
    lines = [
      soLine(),
      soLine({
        id: 41, salesOrderId: 10, partId: 13, partNumber: 'PLT-7', description: 'Base plate',
        remainingQuantity: 40, requestedDeliveryDate: '2026-12-15T00:00:00Z',
      }),
    ];
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);
    f.salesOrderLineId.setValue(41);

    expect(f.partId.value).toBe(13);
    expect(f.quantity.value).toBe(40);
    expect(f.title.value).toBe('PLT-7 — Plate, base');
    expect(f.customerId.value).toBe(88);
    const due = f.dueDate.value!;
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2026, 11, 15]);

    component.onSubmit();
    const payload = createJob.mock.calls[0][0];
    expect(payload).toMatchObject({
      salesOrderLineId: 41, partId: 13, quantity: null, customerId: 88,
      title: 'PLT-7 — Plate, base', dueDate: '2026-12-15T00:00:00Z',
    });
  });

  it('keeps the customer when the next line is on the same sales order', () => {
    lines = [soLine(), soLine({ id: 41, lineNumber: 2, partId: 13, partNumber: 'PLT-7', description: 'Base plate' })];
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);
    f.salesOrderLineId.setValue(41);

    expect(f.customerId.value).toBe(77);
    expect(getSalesOrderById).toHaveBeenCalledOnce();
  });

  it('clears what it filled when the SO line is cleared, but keeps what the user typed', () => {
    render('create');
    const f = component.jobForm.controls;
    f.salesOrderLineId.setValue(40);
    f.dueDate.setValue(new Date(2026, 9, 20));

    f.salesOrderLineId.setValue(null);

    expect(f.partId.value).toBeNull();
    expect(f.quantity.disabled).toBe(true);
    expect(f.title.value).toBe('');
    expect(f.customerId.value).toBeNull();
    expect(f.dueDate.value!.getDate()).toBe(20);
    expect(component.filledFromSoLine()).toBe(false);
  });

  it('does not take the line quantity for a part the user chose that differs from the line', () => {
    render('create');
    const f = component.jobForm.controls;
    f.partId.setValue(99);

    f.salesOrderLineId.setValue(40);

    expect(f.partId.value).toBe(99);
    expect(f.quantity.value).toBe(1);
  });

  it('accepts a fractional remaining quantity from the line', () => {
    lines = [soLine({ remainingQuantity: 0.5 })];
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);

    expect(f.quantity.value).toBe(0.5);
    expect(f.quantity.valid).toBe(true);
  });

  it('leaves an untouched line quantity to the server, which knows the line and part units', () => {
    render('create');
    const f = component.jobForm.controls;
    f.salesOrderLineId.setValue(40);
    expect(f.quantity.value).toBe(500);

    component.onSubmit();

    expect(createJob.mock.calls[0][0]).toMatchObject({ salesOrderLineId: 40, partId: 12, quantity: null });
  });

  it('sends the quantity the user typed over the line quantity', () => {
    render('create');
    const f = component.jobForm.controls;
    f.salesOrderLineId.setValue(40);
    f.quantity.setValue(120);
    f.quantity.markAsDirty();

    component.onSubmit();

    expect(createJob.mock.calls[0][0]).toMatchObject({ salesOrderLineId: 40, partId: 12, quantity: 120 });
  });

  it('keeps the default quantity when the line has no remaining quantity to offer', () => {
    lines = [soLine({ remainingQuantity: null })];
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);

    expect(f.partId.value).toBe(12);
    expect(f.quantity.value).toBe(1);
    component.onSubmit();
    expect(createJob.mock.calls[0][0]).toMatchObject({ partId: 12, quantity: 1 });
  });

  it('labels a part restored from a draft with its part number', () => {
    render('create');

    component.draftConfig.restoreFn!({ title: 'Saved draft', partId: 12, quantity: 30 });

    const f = component.jobForm.controls;
    expect(f.partId.value).toBe(12);
    expect(f.quantity.value).toBe(30);
    expect(f.quantity.enabled).toBe(true);
    expect(getPartById).toHaveBeenCalledWith(12);
    expect(component.partLabel()).toEqual({ id: 12, text: 'BRK-100' });
  });

  it('drops a restored part that no longer exists', () => {
    render('create');

    component.draftConfig.restoreFn!({ title: 'Saved draft', partId: 404, quantity: 30 });

    expect(component.jobForm.controls.partId.value).toBeNull();
  });

  it('uses the line due date as the same calendar day', () => {
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);

    const due = f.dueDate.value!;
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2026, 9, 7]);
  });

  it('loads an edited due date as its UTC calendar day', () => {
    render('edit', {
      id: 3,
      jobNumber: 'JOB-0003',
      title: 'Bracket run',
      description: null,
      trackTypeId: 1,
      customerId: null,
      assigneeId: null,
      priority: 'Normal',
      dueDate: '2026-10-07T00:00:00Z',
      disposition: null,
    } as unknown as JobDetail);

    const due = component.jobForm.controls.dueDate.value!;
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([2026, 9, 7]);

    const savedJobs: JobDetail[] = [];
    fixture.componentInstance.saved.subscribe(j => savedJobs.push(j));
    const update = new Subject<void>();
    updateJob.mockReturnValue(update);
    (fixture.componentInstance as unknown as { dialogRef: { clearDraft(): void } }).dialogRef = { clearDraft: vi.fn() };

    component.onSubmit();
    expect(updateJob.mock.calls[0][1].dueDate).toBe('2026-10-07T00:00:00Z');

    update.next();
    expect(new Date(savedJobs[0].dueDate!).toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });

  it('starts a new job in the first visible status of the chosen order type', () => {
    render('create', null, stagedTrackTypes);
    const f = component.jobForm.controls;

    expect(f.initialStageId.value).toBe(11);

    f.trackTypeId.setValue(2);
    expect(f.initialStageId.value).toBe(21);
  });

  it('offers only statuses before the first required status and never the final one', () => {
    render('create', null, stagedTrackTypes);
    expect(component.startStageOptions().map(o => o.value)).toEqual([11, 13, 14]);

    component.jobForm.controls.trackTypeId.setValue(3);
    expect(component.startStageOptions().map(o => o.value)).toEqual([31, 32]);

    component.jobForm.controls.trackTypeId.setValue(2);
    expect(component.startStageOptions().map(o => o.value)).toEqual([21]);
  });

  it('offers no status at or past the first one that queues an accounting document', () => {
    render('create', null, documentTrackTypes);
    expect(component.startStageOptions().map(o => o.value)).toEqual([11, 12]);
  });

  it('still offers Order Confirmed for a job linked to a sales-order line, and nothing later', () => {
    render('create', null, documentTrackTypes);
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);
    expect(component.startStageOptions().map(o => o.value)).toEqual([11, 12, 14]);
    expect(f.initialStageId.value).toBe(14);

    f.salesOrderLineId.setValue(null);
    expect(component.startStageOptions().map(o => o.value)).toEqual([11, 12]);
    expect(f.initialStageId.value).toBe(11);
  });

  it('moves the default to Order Confirmed once a sales-order line is picked', () => {
    render('create', null, stagedTrackTypes);
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);
    expect(f.initialStageId.value).toBe(13);

    f.salesOrderLineId.setValue(null);
    expect(f.initialStageId.value).toBe(11);
  });

  it('keeps a status the user picked and sends it as initialStageId', () => {
    render('create', null, stagedTrackTypes);
    const f = component.jobForm.controls;
    f.title.setValue('Bracket run');
    f.initialStageId.setValue(14);
    f.initialStageId.markAsDirty();

    f.salesOrderLineId.setValue(40);
    expect(f.initialStageId.value).toBe(14);

    component.onSubmit();
    expect(createJob.mock.calls[0][0].initialStageId).toBe(14);
  });
});
