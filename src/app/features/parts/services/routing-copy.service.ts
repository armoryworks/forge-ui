import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Operation } from '../models/operation.model';

@Injectable({ providedIn: 'root' })
export class RoutingCopyService {
  private readonly http = inject(HttpClient);

  copyFrom(partId: number, sourcePartId: number): Observable<Operation[]> {
    return this.http.post<Operation[]>(
      `${environment.apiUrl}/parts/${partId}/routing/copy-from/${sourcePartId}`, null);
  }
}
