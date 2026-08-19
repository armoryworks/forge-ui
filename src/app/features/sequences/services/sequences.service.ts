import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  SequenceDefinition, SequenceDefinitionRequest, SequenceDefinitionStatus, SequenceEvent, SequenceInstance,
  SequenceInstanceStatus, SequenceResourceClock, StartSequenceRequest,
} from '../models/sequence.model';

/** Gated Sequence Engine client — `api/v1/sequences` (CAP-CROSS-SEQUENCES). */
@Injectable({ providedIn: 'root' })
export class SequencesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sequences`;

  // ----- definitions -----
  getDefinitions(code?: string, status?: SequenceDefinitionStatus): Observable<SequenceDefinition[]> {
    let params = new HttpParams();
    if (code) params = params.set('code', code);
    if (status) params = params.set('status', status);
    return this.http.get<SequenceDefinition[]>(`${this.base}/definitions`, { params });
  }

  getDefinition(id: number): Observable<SequenceDefinition> {
    return this.http.get<SequenceDefinition>(`${this.base}/definitions/${id}`);
  }

  createDefinition(model: SequenceDefinitionRequest): Observable<SequenceDefinition> {
    return this.http.post<SequenceDefinition>(`${this.base}/definitions`, model);
  }

  updateDefinition(id: number, model: SequenceDefinitionRequest): Observable<SequenceDefinition> {
    return this.http.put<SequenceDefinition>(`${this.base}/definitions/${id}`, model);
  }

  publishDefinition(id: number): Observable<SequenceDefinition> {
    return this.http.post<SequenceDefinition>(`${this.base}/definitions/${id}/publish`, {});
  }

  newDefinitionVersion(id: number): Observable<SequenceDefinition> {
    return this.http.post<SequenceDefinition>(`${this.base}/definitions/${id}/new-version`, {});
  }

  retireDefinition(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/definitions/${id}`);
  }

  // ----- instances -----
  getInstances(filter: { subjectEntityType?: string; subjectEntityId?: number; status?: SequenceInstanceStatus; definitionId?: number } = {}): Observable<SequenceInstance[]> {
    let params = new HttpParams();
    if (filter.subjectEntityType) params = params.set('subjectEntityType', filter.subjectEntityType);
    if (filter.subjectEntityId != null) params = params.set('subjectEntityId', filter.subjectEntityId);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.definitionId != null) params = params.set('definitionId', filter.definitionId);
    return this.http.get<SequenceInstance[]>(`${this.base}/instances`, { params });
  }

  getInstance(id: number): Observable<SequenceInstance> {
    return this.http.get<SequenceInstance>(`${this.base}/instances/${id}`);
  }

  getEvents(id: number): Observable<SequenceEvent[]> {
    return this.http.get<SequenceEvent[]>(`${this.base}/instances/${id}/events`);
  }

  start(model: StartSequenceRequest): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances`, model);
  }

  reevaluate(id: number): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/reevaluate`, {});
  }

  cancel(id: number, reason: string): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/cancel`, { reason });
  }

  rework(id: number, targetStepKey: string, reason: string): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/rework`, { targetStepKey, reason });
  }

  startStep(id: number, stepKey: string): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/steps/${encodeURIComponent(stepKey)}/start`, {});
  }

  completeStep(id: number, stepKey: string): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/steps/${encodeURIComponent(stepKey)}/complete`, {});
  }

  skipStep(id: number, stepKey: string, reason: string): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/steps/${encodeURIComponent(stepKey)}/skip`, { reason });
  }

  clearGate(id: number, stepKey: string, gateKey: string): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/gates/${encodeURIComponent(stepKey)}/${encodeURIComponent(gateKey)}/clear`, {});
  }

  overrideGate(id: number, stepKey: string, gateKey: string, reason: string): Observable<SequenceInstance> {
    return this.http.post<SequenceInstance>(`${this.base}/instances/${id}/gates/${encodeURIComponent(stepKey)}/${encodeURIComponent(gateKey)}/override`, { reason });
  }

  // ----- resource clocks -----
  getResourceClocks(resourceType?: string, resourceId?: number, includeFired = false): Observable<SequenceResourceClock[]> {
    let params = new HttpParams().set('includeFired', includeFired);
    if (resourceType) params = params.set('resourceType', resourceType);
    if (resourceId != null) params = params.set('resourceId', resourceId);
    return this.http.get<SequenceResourceClock[]>(`${this.base}/resource-clocks`, { params });
  }
}
