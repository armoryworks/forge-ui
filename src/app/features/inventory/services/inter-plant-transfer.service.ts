import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { InterPlantTransfer } from '../models/inter-plant-transfer.model';
import { InterPlantTransferPlant } from '../models/inter-plant-transfer-plant.model';
import { InterPlantTransferStatus } from '../models/inter-plant-transfer-status.type';
import { CreateInterPlantTransferRequest } from '../models/create-inter-plant-transfer-request.model';
import { ReceiveTransferLineRequest } from '../models/receive-transfer-line-request.model';

@Injectable({ providedIn: 'root' })
export class InterPlantTransferService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inventory/transfers`;

  getTransfers(status?: InterPlantTransferStatus | null): Observable<InterPlantTransfer[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<InterPlantTransfer[]>(this.base, { params });
  }

  getPlants(): Observable<InterPlantTransferPlant[]> {
    return this.http.get<InterPlantTransferPlant[]>(`${this.base}/plants`);
  }

  create(request: CreateInterPlantTransferRequest): Observable<InterPlantTransfer> {
    return this.http.post<InterPlantTransfer>(this.base, request);
  }

  ship(id: number, trackingNumber: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/ship`, { trackingNumber });
  }

  receive(id: number, lines: ReceiveTransferLineRequest[]): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/receive`, lines);
  }

  cancel(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/cancel`, {});
  }
}
