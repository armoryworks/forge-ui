import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ScenarioCheckResult, TrainingSandboxState, TrainingScenario } from '../models/accounting.models';

/**
 * §5A.4 GL training system client (`/api/v1/accounting/training/*`). Same gating as the GL area;
 * the sandbox is the isolated TRAINING book — learners practice on the real ledger/editor surfaces
 * pointed at it via `?bookId=`.
 */
@Injectable({ providedIn: 'root' })
export class TrainingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting/training`;

  /** Sandbox state; server seeds on first touch. */
  getState(): Observable<TrainingSandboxState> {
    return this.http.get<TrainingSandboxState>(`${this.base}/state`);
  }

  /** Wipe + reseed the sandbox (TRAINING-book carve-out). */
  reset(): Observable<TrainingSandboxState> {
    return this.http.post<TrainingSandboxState>(`${this.base}/reset`, {});
  }

  getScenarios(): Observable<TrainingScenario[]> {
    return this.http.get<TrainingScenario[]>(`${this.base}/scenarios`);
  }

  /** Validate a scenario's ledger end-state (never the click path). */
  check(id: string): Observable<ScenarioCheckResult> {
    return this.http.post<ScenarioCheckResult>(`${this.base}/scenarios/${id}/check`, {});
  }
}
