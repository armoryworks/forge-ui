import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PaymentMilestone } from '../../../shared/models/payment-milestone.model';
import { PaymentSchedule } from '../../../shared/models/payment-schedule.model';
import { InvoiceListItem } from '../../invoices/models/invoice-list-item.model';
import { MarkMilestonePaidRequest } from '../models/mark-milestone-paid-request.model';
import { UpsertPaymentScheduleRequest } from '../models/upsert-payment-schedule-request.model';

/**
 * S2 — quote/order pre-payment schedules. The schedule is authored on the
 * quote and re-linked to the sales order at conversion, so it is readable
 * from both documents; milestone actions address the milestone row directly.
 */
@Injectable({ providedIn: 'root' })
export class PaymentScheduleService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Schedule for a quote — null when the quote has none (404). */
  getByQuote(quoteId: number): Observable<PaymentSchedule | null> {
    return this.http
      .get<PaymentSchedule>(`${this.base}/quotes/${quoteId}/payment-schedule`)
      .pipe(catchError((err: HttpErrorResponse) => this.nullOn404(err)));
  }

  /** Schedule for a sales order — null when the order has none (404). */
  getByOrder(salesOrderId: number): Observable<PaymentSchedule | null> {
    return this.http
      .get<PaymentSchedule>(`${this.base}/orders/${salesOrderId}/payment-schedule`)
      .pipe(catchError((err: HttpErrorResponse) => this.nullOn404(err)));
  }

  /**
   * Bulk-replace the quote's schedule definition. Σ percentage must equal
   * 100, max 20 rows; the server rejects with 409 when any existing
   * milestone is already Invoiced / PartiallyPaid / Paid.
   */
  upsert(quoteId: number, request: UpsertPaymentScheduleRequest): Observable<PaymentSchedule> {
    return this.http.put<PaymentSchedule>(`${this.base}/quotes/${quoteId}/payment-schedule`, request);
  }

  /** Record a (possibly partial) payment against a milestone. */
  markPaid(milestoneId: number, request: MarkMilestonePaidRequest): Observable<PaymentMilestone> {
    return this.http.post<PaymentMilestone>(`${this.base}/payment-milestones/${milestoneId}/mark-paid`, request);
  }

  /** Waive a milestone (excluded from the remaining balance). */
  waive(milestoneId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/payment-milestones/${milestoneId}/waive`, {});
  }

  /**
   * Generate a milestone invoice — ⚡ accounting-bounded, standalone
   * accounting mode only (409 otherwise). Callers hide the affordance when
   * `AccountingService.isStandalone()` is false.
   */
  generateInvoice(milestoneId: number): Observable<InvoiceListItem> {
    return this.http.post<InvoiceListItem>(`${this.base}/payment-milestones/${milestoneId}/generate-invoice`, {});
  }

  /** GET "no schedule yet" arrives as a 404 — map it to null, rethrow the rest. */
  private nullOn404(err: HttpErrorResponse): Observable<PaymentSchedule | null> {
    return err.status === 404 ? of(null) : throwError(() => err);
  }
}
