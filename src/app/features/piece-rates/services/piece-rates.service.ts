import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  PieceRate,
  PieceRateCompliance,
  PieceRateTimeline,
  PieceRateUser,
  PieceWorkEntry,
} from '../models/piece-rate.model';

/** Piece-rate timelines, piece-work capture, and the weekly make-up report. */
@Injectable({ providedIn: 'root' })
export class PieceRatesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/piece-rates`;

  getRates(): Observable<PieceRateTimeline[]> {
    return this.http.get<PieceRateTimeline[]>(this.base);
  }

  setRate(partId: number, ratePerPiece: number, effectiveFrom: string | null, notes: string | null): Observable<PieceRate> {
    return this.http.post<PieceRate>(this.base, { partId, operationId: null, ratePerPiece, effectiveFrom, notes });
  }

  getWork(from: string, to: string, userId: number | null): Observable<PieceWorkEntry[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (userId != null) params = params.set('userId', userId);
    return this.http.get<PieceWorkEntry[]>(`${this.base}/work`, { params });
  }

  logWork(userId: number, partId: number, workDate: string, quantity: number): Observable<PieceWorkEntry> {
    return this.http.post<PieceWorkEntry>(`${this.base}/work`, { userId, partId, operationId: null, workDate, quantity, notes: null });
  }

  deleteWork(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/work/${id}`);
  }

  getCompliance(weekStart: string): Observable<PieceRateCompliance> {
    return this.http.get<PieceRateCompliance>(`${this.base}/compliance`, {
      params: new HttpParams().set('weekStart', weekStart),
    });
  }

  getUsers(): Observable<PieceRateUser[]> {
    return this.http.get<PieceRateUser[]>(`${environment.apiUrl}/users`);
  }
}
