import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { JobDialogComponent } from './job-dialog.component';
import { KanbanService } from '../services/kanban.service';
import { SalesOrderService } from '../../sales-orders/services/sales-order.service';
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
  }>;
  filledFromSoLine: () => boolean;
  onSubmit(): void;
}

const trackTypes = [{ id: 1, name: 'Production', isDefault: true, stages: [] }] as unknown as TrackType[];

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
  let lines: AssignableSalesOrderLine[];

  function render(mode: 'create' | 'edit', job: JobDetail | null = null): void {
    fixture = TestBed.createComponent(JobDialogComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('trackTypes', trackTypes);
    fixture.componentRef.setInput('job', job);
    fixture.detectChanges();
    component = fixture.componentInstance as unknown as DialogInternals;
  }

  beforeEach(() => {
    lines = [soLine()];
    createJob = vi.fn(() => new Subject());
    updateJob = vi.fn(() => new Subject());
    getSalesOrderById = vi.fn(() => of({ id: 9, customerId: 77, requestedDeliveryDate: '2026-11-02T00:00:00Z' }));

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
    expect(f.title.value).toBe('BRK-100 — Mounting bracket');
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

  it('replaces a title it filled itself when a different SO line is picked', () => {
    lines = [soLine(), soLine({ id: 41, partNumber: 'PLT-7', description: 'Base plate' })];
    render('create');
    const f = component.jobForm.controls;

    f.salesOrderLineId.setValue(40);
    f.salesOrderLineId.setValue(41);

    expect(f.title.value).toBe('PLT-7 — Base plate');
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

    component.onSubmit();
    expect(updateJob.mock.calls[0][1].dueDate).toBe('2026-10-07T00:00:00Z');
  });
});
