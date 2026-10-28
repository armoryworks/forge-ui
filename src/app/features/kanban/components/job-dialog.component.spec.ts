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
import { AuthService } from '../../../shared/services/auth.service';
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
    extraPieces: FormControl<number | null>;
  }>;
  quantityLabelKey: () => string;
  plannedStart: () => { order: number; extra: number; start: number } | null;
  startPlan: () => { calculatedExtraPieces: number } | null;
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
  let roles: string[];
  let getAssignableSalesOrderLines: ReturnType<typeof vi.fn>;
  let getStartPlan: ReturnType<typeof vi.fn>;

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
    roles = ['Manager'];
    getAssignableSalesOrderLines = vi.fn(() => of(lines));
    createJob = vi.fn(() => new Subject());
    getStartPlan = vi.fn((_partId: number, quantity: number) =>
      of({ orderQuantity: quantity, calculatedStartQuantity: quantity + 6, calculatedExtraPieces: 6 }));
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
            getAssignableSalesOrderLines,
            createJob,
            updateJob,
            getStartPlan,
          },
        },
        { provide: SalesOrderService, useValue: { getSalesOrderById } },
        { provide: PartsService, useValue: { getPartById } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    TestBed.overrideComponent(JobDialogComponent, { set: { template: '' } });
  });

  it('does not ask a production worker\'s create dialog for sales-order lines', () => {
    roles = ['ProductionWorker'];
    render('create');

    expect(getAssignableSalesOrderLines).not.toHaveBeenCalled();
  });

  it('offers sales-order lines to roles that can read orders', () => {
    render('create');

    expect(getAssignableSalesOrderLines).toHaveBeenCalledWith(false);
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

  it('creates one work order when Save fires twice before the server answers', () => {
    render('create');
    component.jobForm.controls.title.setValue('Bracket run');

    component.onSubmit();
    component.onSubmit();

    expect(createJob).toHaveBeenCalledOnce();
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

  it('takes a free-text line\'s remaining quantity for the part the user picks', () => {
    lines = [soLine({ partId: null, partNumber: null, remainingQuantity: 300 })];
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);
    f.partId.setValue(99);

    expect(f.quantity.value).toBe(300);
    component.onSubmit();
    expect(createJob.mock.calls[0][0]).toMatchObject({ salesOrderLineId: 40, partId: 99, quantity: null });
  });

  it('takes a free-text line\'s remaining quantity for a part picked before the line', () => {
    lines = [soLine({ partId: null, partNumber: null, remainingQuantity: 300 })];
    render('create');
    const f = component.jobForm.controls;

    f.partId.setValue(99);
    f.salesOrderLineId.setValue(40);

    expect(f.partId.value).toBe(99);
    expect(f.quantity.value).toBe(300);
  });

  it('drops the line quantity when the user swaps to a part that is not the line\'s', () => {
    render('create');
    const f = component.jobForm.controls;
    f.salesOrderLineId.setValue(40);
    expect(f.quantity.value).toBe(500);

    f.partId.setValue(99);

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

  function editableJob(overrides: Partial<JobDetail> = {}): JobDetail {
    return {
      id: 3, jobNumber: 'JOB-0003', title: 'Bracket run', description: null, trackTypeId: 1,
      customerId: null, assigneeId: null, priority: 'Normal', dueDate: null, disposition: null,
      completedDate: null, isArchived: false, partId: 12, partNumber: 'BRK-100', quantity: 1,
      ...overrides,
    } as unknown as JobDetail;
  }

  function submitEdit(): { saved: JobDetail[]; update: Subject<void> } {
    const saved: JobDetail[] = [];
    fixture.componentInstance.saved.subscribe(j => saved.push(j));
    const update = new Subject<void>();
    updateJob.mockReturnValue(update);
    (fixture.componentInstance as unknown as { dialogRef: { clearDraft(): void } }).dialogRef = { clearDraft: vi.fn() };
    component.onSubmit();
    return { saved, update };
  }

  it('loads the job quantity for editing and sends it when changed', () => {
    render('edit', editableJob());

    const quantity = component.jobForm.controls.quantity;
    expect(quantity.enabled).toBe(true);
    expect(quantity.value).toBe(1);

    quantity.setValue(300);
    const { saved, update } = submitEdit();
    expect(updateJob.mock.calls[0][1].quantity).toBe(300);

    update.next();
    expect(saved[0].quantity).toBe(300);
  });

  it('leaves the quantity out of the update when it is unchanged', () => {
    render('edit', editableJob({ quantity: 40 }));

    submitEdit();

    expect(updateJob.mock.calls[0][1].quantity).toBeUndefined();
  });

  it('does not offer the quantity to roles that cannot save a job edit', () => {
    roles = ['PM'];
    render('edit', editableJob());

    expect(component.jobForm.controls.quantity.enabled).toBe(false);
    submitEdit();
    expect(updateJob.mock.calls[0][1].quantity).toBeUndefined();
  });

  it('does not offer the quantity on a job without a part or one that is finished', () => {
    render('edit', editableJob({ partId: null, quantity: null }));
    expect(component.jobForm.controls.quantity.enabled).toBe(false);
    submitEdit();
    expect(updateJob.mock.calls[0][1].quantity).toBeUndefined();

    fixture.destroy();
    render('edit', editableJob({ disposition: 'ShipToCustomer' }));
    expect(component.jobForm.controls.quantity.enabled).toBe(false);
  });

  it('sends extra pieces on create and calls the quantity the order quantity once they are set', () => {
    render('create');
    const { title, partId, quantity, extraPieces } = component.jobForm.controls;
    title.setValue('Pins');
    partId.setValue(12);
    quantity.setValue(100);
    expect(component.quantityLabelKey()).toBe('kanban.quantityToMake');

    extraPieces.setValue(14);
    component.onSubmit();

    expect(component.quantityLabelKey()).toBe('kanban.orderQuantity');
    expect(component.plannedStart()).toEqual({ order: 100, extra: 14, start: 114 });
    expect(createJob.mock.calls[0][0]).toEqual(expect.objectContaining({ partId: 12, quantity: 100, extraPieces: 14 }));
  });

  it('leaves extra pieces out of a create when blank and shows the calculated plan as the hint', () => {
    vi.useFakeTimers();
    try {
      render('create');
      component.jobForm.controls.title.setValue('Pins');
      component.jobForm.controls.partId.setValue(12);
      component.jobForm.controls.quantity.setValue(100);
      vi.advanceTimersByTime(300);

      expect(getStartPlan).toHaveBeenLastCalledWith(12, 100, null, null);
      expect(component.startPlan()?.calculatedExtraPieces).toBe(6);
      component.onSubmit();
      expect(createJob.mock.calls[0][0].extraPieces).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses negative or fractional extra pieces', () => {
    render('create');
    const { partId, extraPieces } = component.jobForm.controls;
    partId.setValue(12);

    extraPieces.setValue(-1);
    expect(extraPieces.invalid).toBe(true);
    extraPieces.setValue(2.5);
    expect(extraPieces.invalid).toBe(true);
    extraPieces.setValue(3);
    expect(extraPieces.valid).toBe(true);
  });

  it('edits a job with extra pieces as order quantity plus extras', () => {
    render('edit', editableJob({ quantity: 114, targetQuantity: 100, extraPieces: 14 }));
    const { quantity, extraPieces } = component.jobForm.controls;
    expect(quantity.value).toBe(100);
    expect(extraPieces.value).toBe(14);

    extraPieces.setValue(10);
    submitEdit();

    expect(updateJob.mock.calls[0][1]).toEqual(expect.objectContaining({ extraPieces: 10, quantity: 100 }));
  });

  it('switches the quantity to the order when extras are first set on a planned job, and clears them back', () => {
    render('edit', editableJob({ quantity: 106, targetQuantity: 100, extraPieces: null }));
    const { quantity, extraPieces } = component.jobForm.controls;
    expect(quantity.value).toBe(106);

    extraPieces.setValue(14);
    expect(quantity.value).toBe(100);
    extraPieces.setValue(null);
    expect(quantity.value).toBe(106);
  });

  it('clears extra pieces with a clear flag and no quantity', () => {
    render('edit', editableJob({ quantity: 114, targetQuantity: 100, extraPieces: 14 }));

    component.jobForm.controls.extraPieces.setValue(null);
    submitEdit();

    expect(updateJob.mock.calls[0][1]).toEqual(expect.objectContaining({ clearExtraPieces: true }));
    expect(updateJob.mock.calls[0][1].quantity).toBeUndefined();
    expect(updateJob.mock.calls[0][1].extraPieces).toBeUndefined();
  });
});
