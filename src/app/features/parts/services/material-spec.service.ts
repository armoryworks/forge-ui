import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ReferenceDataItem } from '../../../shared/services/reference-data.service';
import { CreateMaterialSpecRequest } from '../models/create-material-spec-request.model';

@Injectable({ providedIn: 'root' })
export class MaterialSpecService {
  private readonly http = inject(HttpClient);

  create(body: CreateMaterialSpecRequest): Observable<ReferenceDataItem> {
    return this.http.post<ReferenceDataItem>(`${environment.apiUrl}/material-specs`, body);
  }
}
