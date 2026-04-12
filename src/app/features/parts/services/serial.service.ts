import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  SerialNumber, SerialHistory, SerialGenealogy,
  SerialNumberStatus, CreateSerialNumberRequest, TransferSerialRequest,
} from '../models/serial-number.model';

@Injectable({ providedIn: 'root' })
export class SerialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/serials`;

  getPartSerials(partId: number, status?: SerialNumberStatus): Observable<SerialNumber[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<SerialNumber[]>(`${this.base}/part/${partId}`, { params });
  }

  createSerialNumber(partId: number, request: CreateSerialNumberRequest): Observable<SerialNumber> {
    return this.http.post<SerialNumber>(`${this.base}/part/${partId}`, request);
  }

  getGenealogy(serialValue: string): Observable<SerialGenealogy> {
    return this.http.get<SerialGenealogy>(`${this.base}/${encodeURIComponent(serialValue)}/genealogy`);
  }

  transferSerial(id: number, request: TransferSerialRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/transfer`, request);
  }

  getSerialHistory(id: number): Observable<SerialHistory[]> {
    return this.http.get<SerialHistory[]>(`${this.base}/${id}/history`);
  }
}
