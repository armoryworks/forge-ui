import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AbcClassificationParameters } from '../models/abc-classification-parameters.model';
import { AbcClassificationResult } from '../models/abc-classification-result.model';
import { AbcClassificationRun } from '../models/abc-classification-run.model';

@Injectable({ providedIn: 'root' })
export class AbcClassificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inventory/abc`;

  run(parameters: AbcClassificationParameters): Observable<AbcClassificationRun> {
    return this.http.post<AbcClassificationRun>(`${this.base}/run`, parameters);
  }

  getRuns(): Observable<AbcClassificationRun[]> {
    return this.http.get<AbcClassificationRun[]>(`${this.base}/runs`);
  }

  getResults(runId: number): Observable<AbcClassificationResult[]> {
    return this.http.get<AbcClassificationResult[]>(`${this.base}/runs/${runId}/results`);
  }

  apply(runId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/runs/${runId}/apply`, {});
  }
}
