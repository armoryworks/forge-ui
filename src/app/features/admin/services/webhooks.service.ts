import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateWebhookSubscriptionRequest,
  UpdateWebhookSubscriptionRequest,
  WebhookDelivery,
  WebhookSubscription,
} from '../models/webhook.model';

@Injectable({ providedIn: 'root' })
export class WebhooksService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/webhooks`;

  list(): Observable<WebhookSubscription[]> {
    return this.http.get<WebhookSubscription[]>(this.base);
  }

  eventTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/event-types`);
  }

  create(request: CreateWebhookSubscriptionRequest): Observable<WebhookSubscription> {
    return this.http.post<WebhookSubscription>(this.base, request);
  }

  update(id: number, request: UpdateWebhookSubscriptionRequest): Observable<WebhookSubscription> {
    return this.http.put<WebhookSubscription>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  test(id: number): Observable<WebhookDelivery> {
    return this.http.post<WebhookDelivery>(`${this.base}/${id}/test`, {});
  }

  deliveries(id: number): Observable<WebhookDelivery[]> {
    return this.http.get<WebhookDelivery[]>(`${this.base}/${id}/deliveries`);
  }

  redeliver(deliveryId: number): Observable<WebhookDelivery> {
    return this.http.post<WebhookDelivery>(`${this.base}/deliveries/${deliveryId}/redeliver`, {});
  }
}
