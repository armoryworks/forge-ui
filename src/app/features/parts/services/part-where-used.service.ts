import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PartWhereUsed } from '../models/part-where-used.model';

@Injectable({ providedIn: 'root' })
export class PartWhereUsedService {
  private readonly http = inject(HttpClient);

  getWhereUsed(partId: number): Observable<PartWhereUsed[]> {
    return this.http.get<PartWhereUsed[]>(`${environment.apiUrl}/parts/${partId}/where-used`);
  }
}
