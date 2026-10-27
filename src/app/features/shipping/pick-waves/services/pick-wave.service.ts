import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PickWave } from '../models/pick-wave.model';
import { PickLine } from '../models/pick-line.model';
import { PickWaveStatus } from '../models/pick-wave-status.model';
import { AutoWaveParameters } from '../models/auto-wave-parameters.model';
import { ConfirmPickLineRequest } from '../models/confirm-pick-line-request.model';

@Injectable({ providedIn: 'root' })
export class PickWaveService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/pick-waves`;

  getWaves(status?: PickWaveStatus | null): Observable<PickWave[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<PickWave[]>(this.base, { params });
  }

  getWave(id: number): Observable<PickWave> {
    return this.http.get<PickWave>(`${this.base}/${id}`);
  }

  /** Open lines on released waves assigned to the caller or to no one, in walk order. */
  getMyLines(): Observable<PickLine[]> {
    return this.http.get<PickLine[]>(`${this.base}/my-lines`);
  }

  autoGenerate(parameters: AutoWaveParameters): Observable<PickWave> {
    return this.http.post<PickWave>(`${this.base}/auto-generate`, parameters);
  }

  release(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/release`, {});
  }

  confirmLine(waveId: number, lineId: number, request: ConfirmPickLineRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${waveId}/lines/${lineId}/confirm`, request);
  }

  complete(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/complete`, {});
  }

  /** URL of the printable pick list PDF, for FileDownloadService (which adds the session). */
  pdfUrl(id: number): string {
    return `${this.base}/${id}/pdf`;
  }
}
