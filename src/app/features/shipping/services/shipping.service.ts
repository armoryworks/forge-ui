import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ReadyToShipOrder } from '../models/ready-to-ship-order.model';

/** Shipping fulfillment workspace — the ready-to-ship queue (CAP-O2C-SHIP). */
@Injectable({ providedIn: 'root' })
export class ShippingService {
  private readonly http = inject(HttpClient);

  getReadyToShip(): Observable<ReadyToShipOrder[]> {
    return this.http.get<ReadyToShipOrder[]>(`${environment.apiUrl}/shipments/ready-to-ship`);
  }
}
