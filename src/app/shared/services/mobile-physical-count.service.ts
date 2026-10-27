import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';

import { Observable } from 'rxjs';

import { PhysicalInventory } from '../../features/inventory/physical-inventory/models/physical-inventory.model';
import { PhysicalInventoryTag } from '../../features/inventory/physical-inventory/models/physical-inventory-tag.model';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { randomId } from '../utils/random-id';

/**
 * Physical inventory count entry from the phone. Online only, like dock receiving: a count never goes to the
 * offline queue, and failures come back silent so the page can show the server's own message.
 */
@Injectable({ providedIn: 'root' })
export class MobilePhysicalCountService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/inventory/physical-inventory';

  counting(): Observable<PhysicalInventory[]> {
    return this.http.get<PhysicalInventory[]>(this.base, { context: this.silent() });
  }

  tag(inventoryId: number, tagNumber: number): Observable<PhysicalInventoryTag> {
    return this.http.get<PhysicalInventoryTag>(`${this.base}/${inventoryId}/tags/by-number/${tagNumber}`, { context: this.silent() });
  }

  count(inventoryId: number, tagId: number, quantity: number): Observable<PhysicalInventoryTag> {
    return this.http.put<PhysicalInventoryTag>(`${this.base}/${inventoryId}/tags/${tagId}/count`, { quantity, notes: null }, {
      headers: new HttpHeaders({ 'Idempotency-Key': randomId() }),
      context: this.silent(),
    });
  }

  private silent(): HttpContext {
    return new HttpContext().set(SILENT_HTTP_ERRORS, true);
  }
}
