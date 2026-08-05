import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { JobCardComponent } from './job-card.component';
import { KanbanJob } from '../models/kanban-job.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function job(overrides: Partial<KanbanJob> = {}): KanbanJob {
  return {
    id: 1,
    jobNumber: 'JOB-0001',
    title: 'Bracket run',
    stageName: 'In Production',
    stageColor: '#f59e0b',
    assigneeId: null,
    assigneeInitials: null,
    assigneeColor: null,
    priorityName: 'Normal',
    dueDate: null,
    isOverdue: false,
    customerName: null,
    customerId: null,
    salesOrderId: null,
    salesOrderNumber: null,
    billingStatus: null,
    externalRef: null,
    accountingDocumentType: null,
    disposition: null,
    childJobCount: 0,
    activeHolds: [],
    coverPhotoUrl: null,
    parentJobId: null,
    parentJobNumber: null,
    ...overrides,
  };
}

/**
 * A card as it appears in the final 'Payment Received' column — completed,
 * invoiced, disposed, carrying an accounting externalRef chip. Used to prove
 * no status-dependent branch breaks the job-number click path (meeting report:
 * "clicking the work-item ID on a Payment Received card didn't open the job").
 */
function finalColumnJob(): KanbanJob {
  return job({
    stageName: 'Payment Received',
    stageColor: '#15803d',
    billingStatus: 'Invoiced',
    externalRef: 'QB-INV-2041',
    accountingDocumentType: 'Payment',
    disposition: 'ShipToCustomer',
    customerName: 'Acme Tooling',
    customerId: 7,
    salesOrderId: 55,
    salesOrderNumber: 'SO-1055',
  });
}

describe('JobCardComponent', () => {
  let fixture: ComponentFixture<JobCardComponent>;
  let routerNavigate: ReturnType<typeof vi.fn>;

  function render(j: KanbanJob): void {
    fixture = TestBed.createComponent(JobCardComponent);
    fixture.componentRef.setInput('job', j);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    routerNavigate = vi.fn();
    TestBed.configureTestingModule({
      imports: [JobCardComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });
  });

  // ── Task 3: job-number click works in every column, including the final one ──

  it('emits jobNumberClicked (not cardClicked) when the job number is clicked on a plain card', () => {
    render(job());
    const numberClicked = vi.fn();
    const cardClicked = vi.fn();
    fixture.componentInstance.jobNumberClicked.subscribe(numberClicked);
    fixture.componentInstance.cardClicked.subscribe(cardClicked);

    el().querySelector<HTMLButtonElement>('.card__job-number')!.click();

    expect(numberClicked).toHaveBeenCalledOnce();
    expect(numberClicked.mock.calls[0][0].job.id).toBe(1);
    expect(cardClicked).not.toHaveBeenCalled();
  });

  it('emits jobNumberClicked identically for a final-column (Payment Received) card', () => {
    render(finalColumnJob());
    const numberClicked = vi.fn();
    const cardClicked = vi.fn();
    fixture.componentInstance.jobNumberClicked.subscribe(numberClicked);
    fixture.componentInstance.cardClicked.subscribe(cardClicked);

    const btn = el().querySelector<HTMLButtonElement>('[data-testid="job-card-number-JOB-0001"]');
    expect(btn).not.toBeNull();
    btn!.click();

    expect(numberClicked).toHaveBeenCalledOnce();
    expect(cardClicked).not.toHaveBeenCalled();
  });

  // ── Task 3: accounting externalRef chip is clickable ──

  it('renders the externalRef chip as a button and emits accountingRefClicked without selecting the card', () => {
    render(finalColumnJob());
    const refClicked = vi.fn();
    const cardClicked = vi.fn();
    fixture.componentInstance.accountingRefClicked.subscribe(refClicked);
    fixture.componentInstance.cardClicked.subscribe(cardClicked);

    const chip = el().querySelector<HTMLButtonElement>('[data-testid="job-card-accounting-ref"]');
    expect(chip).not.toBeNull();
    expect(chip!.tagName).toBe('BUTTON');
    expect(chip!.textContent).toContain('QB-INV-2041');
    chip!.click();

    expect(refClicked).toHaveBeenCalledOnce();
    expect(refClicked.mock.calls[0][0].job.externalRef).toBe('QB-INV-2041');
    expect(cardClicked).not.toHaveBeenCalled();
  });

  it('does not render the externalRef chip when the job has no externalRef', () => {
    render(job());
    expect(el().querySelector('[data-testid="job-card-accounting-ref"]')).toBeNull();
  });

  // ── Task 2: customer back-link ──

  it('renders the customer name as a link that navigates to the customer detail route', () => {
    render(job({ customerId: 7, customerName: 'Acme Tooling' }));

    const link = el().querySelector<HTMLAnchorElement>('.card__customer-link a.entity-link');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain('Acme Tooling');
    link!.click();

    expect(routerNavigate).toHaveBeenCalledWith(
      ['/customers'], { queryParams: { detail: 'customer:7' } });
  });

  it('renders the customer name as plain text when no customerId is present', () => {
    render(job({ customerId: null, customerName: 'Legacy Name' }));

    expect(el().querySelector('.card__customer-link')).toBeNull();
    const plain = el().querySelector('.card__customer--plain');
    expect(plain).not.toBeNull();
    expect(plain!.textContent).toContain('Legacy Name');
  });

  // ── Task 2: sales-order back-link ──

  it('renders a sales-order link that navigates to the sales order detail', () => {
    render(job({ salesOrderId: 55, salesOrderNumber: 'SO-1055' }));

    const link = el().querySelector<HTMLAnchorElement>('.card__so a.entity-link');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain('SO-1055');
    link!.click();

    expect(routerNavigate).toHaveBeenCalledWith(
      ['/sales-orders'], { queryParams: { detail: 'sales-order:55' } });
  });

  it('does not render a sales-order link when the job has no SO back-link', () => {
    render(job());
    expect(el().querySelector('.card__so')).toBeNull();
  });

  it('sales-order link click does not trigger card selection', () => {
    render(job({ salesOrderId: 55, salesOrderNumber: 'SO-1055' }));
    const cardClicked = vi.fn();
    fixture.componentInstance.cardClicked.subscribe(cardClicked);

    el().querySelector<HTMLAnchorElement>('.card__so a.entity-link')!.click();

    expect(cardClicked).not.toHaveBeenCalled();
  });
});
