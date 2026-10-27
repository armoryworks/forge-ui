import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ReferenceDataItem } from '../../../shared/services/reference-data.service';
import { CreateMaterialSpecRequest } from '../models/create-material-spec-request.model';
import { MaterialSpec } from '../models/material-spec.model';
import { UpdateMaterialSpecRequest } from '../models/update-material-spec-request.model';

@Injectable({ providedIn: 'root' })
export class MaterialSpecService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/material-specs`;

  list(includeRetired: boolean): Observable<MaterialSpec[]> {
    return this.http.get<MaterialSpec[]>(this.base, { params: new HttpParams().set('includeRetired', includeRetired) });
  }

  create(body: CreateMaterialSpecRequest): Observable<ReferenceDataItem> {
    return this.http.post<ReferenceDataItem>(this.base, body);
  }

  update(id: number, body: UpdateMaterialSpecRequest): Observable<MaterialSpec> {
    return this.http.put<MaterialSpec>(`${this.base}/${id}`, body);
  }

  retire(id: number): Observable<MaterialSpec> {
    return this.http.post<MaterialSpec>(`${this.base}/${id}/retire`, {});
  }

  reactivate(id: number): Observable<MaterialSpec> {
    return this.http.post<MaterialSpec>(`${this.base}/${id}/reactivate`, {});
  }
}
